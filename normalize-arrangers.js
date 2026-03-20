require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_PATH = path.join(__dirname, 'public', 'almedalen-all.json');
const DEDUP_BATCH_SIZE = 100;

// ============================================================
// STEP 1: Split organizer strings into individual names
// ============================================================
function splitOrganizers(events) {
  const results = []; // { year, event_id, org_name, position }

  for (const event of events) {
    if (!event.organizer) continue;

    const parts = event.organizer.split(',').map(s => s.trim()).filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      results.push({
        year: event.year,
        event_id: event.event_id,
        org_name: parts[i],
        position: i,
      });
    }
  }

  return results;
}

// ============================================================
// STEP 2: Basic normalization + Claude dedup
// ============================================================
function basicNormalize(name) {
  return name
    .trim()
    .replace(/\s+/g, ' ')           // collapse whitespace
    .replace(/\.$/g, '')              // trailing period
    .replace(/,$/g, '')               // trailing comma
    .replace(/\s*\(?\s*$/g, '')       // trailing open paren
    .trim();
}

async function deduplicateWithClaude(names) {
  // Group by lowercase to find obvious duplicates first
  const lowerMap = new Map(); // lowercase → [original names]
  for (const name of names) {
    const key = name.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!lowerMap.has(key)) lowerMap.set(key, []);
    lowerMap.get(key).push(name);
  }

  // For exact lowercase matches, pick the most common casing
  const quickDedup = new Map(); // original name → canonical name
  let quickMerged = 0;
  for (const [key, variants] of lowerMap) {
    // Pick the variant that appears most (or first)
    const canonical = variants[0];
    for (const v of variants) {
      quickDedup.set(v, canonical);
      if (v !== canonical) quickMerged++;
    }
  }

  console.log(`Quick dedup: ${names.length} → ${lowerMap.size} unique (${quickMerged} merged by case)`);

  // Now use Claude to find near-duplicates among the remaining unique names
  const uniqueNames = [...lowerMap.keys()].map(k => lowerMap.get(k)[0]);

  console.log(`Sending ${uniqueNames.length} unique names to Claude for dedup...`);

  const SYSTEM = `Du normaliserar svenska organisationsnamn. Du får en lista med namn och ska returnera en JSON-array där varje element har:
- "name": originalnamnet
- "canonical": det kanoniska/officiella namnet (utan förkortningar i parentes, utan "AB" suffix om det inte är centralt)
- "confidence": 0.0-1.0

Regler:
- "Uppsala Universitet" och "Uppsala universitet" → canonical: "Uppsala universitet"
- Behåll "AB" bara om det är ett företagsnamn där det är viktigt (t.ex. "Volvo Cars" inte "Volvo Cars AB")
- Ta bort trailing punkter, paranteser som bara förtydligar
- Om du INTE är säker att två namn är samma org, ge dem OLIKA canonical namn
- Svara ENBART med JSON-array`;

  const canonicalMap = new Map(); // original → canonical

  for (let i = 0; i < uniqueNames.length; i += DEDUP_BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + DEDUP_BATCH_SIZE);
    process.stdout.write(`\r  Dedup: ${Math.min(i + DEDUP_BATCH_SIZE, uniqueNames.length)}/${uniqueNames.length}`);

    try {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Normalisera dessa namn:\n${JSON.stringify(batch)}`
        }],
      });

      const text = response.content[0].text;
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const results = JSON.parse(match[0]);
        for (const r of results) {
          canonicalMap.set(r.name, r.canonical || r.name);
        }
      }
    } catch (err) {
      console.error(`\nAPI error at ${i}:`, err.message?.substring(0, 100));
      // Fallback: keep original names
      for (const name of batch) {
        canonicalMap.set(name, name);
      }
    }
  }

  console.log(`\nClaude dedup done. ${canonicalMap.size} names processed.`);

  // Build final mapping: original name → canonical name
  const finalMap = new Map();
  for (const [original, quickCanonical] of quickDedup) {
    const claudeCanonical = canonicalMap.get(quickCanonical) || quickCanonical;
    finalMap.set(original, claudeCanonical);
  }

  // Count unique canonical names
  const uniqueCanonical = new Set(finalMap.values());
  console.log(`Final unique organizations: ${uniqueCanonical.size}`);

  return finalMap;
}

// ============================================================
// Paginated Supabase fetch
// ============================================================
async function fetchAll(table, columns) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from(table).select(columns).range(from, from + 999);
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  // Load raw data
  console.log('Loading data...');
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const allEvents = Array.isArray(raw) ? raw : Object.values(raw);

  // Deduplicate events
  const deduped = new Map();
  for (const e of allEvents) deduped.set(`${e.year}_${e.event_id}`, e);
  const events = [...deduped.values()];
  console.log(`${events.length} events loaded.`);

  // STEP 1: Split organizer strings
  console.log('\n--- Step 1: Splitting organizer strings ---');
  const splits = splitOrganizers(events);
  console.log(`Total org mentions: ${splits.length}`);
  console.log(`Avg orgs per event: ${(splits.length / events.length).toFixed(2)}`);

  // Collect unique org names
  const uniqueNames = [...new Set(splits.map(s => basicNormalize(s.org_name)))].filter(Boolean);
  console.log(`Unique org names (after basic normalization): ${uniqueNames.length}`);

  // STEP 2: Deduplicate with Claude
  console.log('\n--- Step 2: Deduplicating with Claude ---');
  const canonicalMap = await deduplicateWithClaude(uniqueNames);

  // Build canonical → first_seen_year
  const canonicalYears = new Map();
  for (const s of splits) {
    const normalized = basicNormalize(s.org_name);
    const canonical = canonicalMap.get(normalized) || normalized;
    const existing = canonicalYears.get(canonical);
    if (!existing || s.year < existing) {
      canonicalYears.set(canonical, s.year);
    }
  }

  // STEP 3: Rebuild arrangers table
  console.log('\n--- Step 3: Rebuilding arrangers table ---');

  // Clear existing data
  console.log('Clearing existing data...');
  await supabase.from('event_arrangers').delete().gte('event_id', 0);
  await supabase.from('arranger_classifications').delete().gte('arranger_id', 0);
  await supabase.from('arrangers').delete().gte('id', 0);

  // Insert new arrangers
  const arrangerList = [...canonicalYears.entries()].map(([name, year]) => ({
    name,
    name_normalized: name.toLowerCase().trim(),
    first_seen_year: year,
  }));

  console.log(`Inserting ${arrangerList.length} arrangers...`);
  const BATCH = 200;
  for (let i = 0; i < arrangerList.length; i += BATCH) {
    const batch = arrangerList.slice(i, i + BATCH);
    process.stdout.write(`\r  ${Math.min(i + BATCH, arrangerList.length)}/${arrangerList.length}`);
    const { error } = await supabase.from('arrangers').insert(batch);
    if (error) console.error(`\nInsert error at ${i}:`, error.message);
  }

  // Fetch back all arrangers with their IDs
  console.log('\nFetching arrangers with IDs...');
  const dbArrangers = await fetchAll('arrangers', 'id, name');
  const arrangerIdMap = new Map(); // canonical name → db id
  for (const a of dbArrangers) {
    arrangerIdMap.set(a.name, a.id);
  }
  console.log(`${arrangerIdMap.size} arrangers in DB.`);

  // STEP 4: Link events → arrangers
  console.log('\n--- Step 4: Linking events to arrangers ---');

  // Get all events from DB
  const dbEvents = await fetchAll('events', 'id, source_id, year');
  const eventIdMap = new Map();
  for (const e of dbEvents) {
    eventIdMap.set(`${e.year}_${e.source_id}`, e.id);
  }

  const links = [];
  let missingEvent = 0;
  let missingArranger = 0;

  for (const s of splits) {
    const eventDbId = eventIdMap.get(`${s.year}_${s.event_id}`);
    if (!eventDbId) { missingEvent++; continue; }

    const normalized = basicNormalize(s.org_name);
    const canonical = canonicalMap.get(normalized) || normalized;
    const arrangerId = arrangerIdMap.get(canonical);
    if (!arrangerId) { missingArranger++; continue; }

    links.push({
      event_id: eventDbId,
      arranger_id: arrangerId,
      is_primary: s.position === 0,
    });
  }

  // Deduplicate links (same event+arranger can appear if same org listed twice)
  const linkKey = l => `${l.event_id}_${l.arranger_id}`;
  const uniqueLinks = [...new Map(links.map(l => [linkKey(l), l])).values()];

  console.log(`Creating ${uniqueLinks.length} event-arranger links...`);
  console.log(`  (missing events: ${missingEvent}, missing arrangers: ${missingArranger})`);

  for (let i = 0; i < uniqueLinks.length; i += BATCH) {
    const batch = uniqueLinks.slice(i, i + BATCH);
    process.stdout.write(`\r  ${Math.min(i + BATCH, uniqueLinks.length)}/${uniqueLinks.length}`);
    const { error } = await supabase
      .from('event_arrangers')
      .upsert(batch, { onConflict: 'event_id,arranger_id', ignoreDuplicates: true });
    if (error) console.error(`\nLink error at ${i}:`, error.message);
  }

  // VERIFICATION
  console.log('\n\n=== Verification ===');
  const { count: arrangerCount } = await supabase.from('arrangers').select('*', { count: 'exact', head: true });
  const { count: linkCount } = await supabase.from('event_arrangers').select('*', { count: 'exact', head: true });
  const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true });

  console.log(`Events: ${eventCount}`);
  console.log(`Unique arrangers: ${arrangerCount}`);
  console.log(`Event-arranger links: ${linkCount}`);
  console.log(`Avg links per event: ${(linkCount / eventCount).toFixed(2)}`);

  // Save canonical map for reference
  const mapObj = Object.fromEntries(canonicalMap);
  fs.writeFileSync('/tmp/canonical-map.json', JSON.stringify(mapObj, null, 2));
  console.log('\nCanonical map saved to /tmp/canonical-map.json');
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

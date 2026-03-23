#!/usr/bin/env node
/**
 * Analyze Business Arena events to identify the ACTUAL arranger behind each event.
 * Business Arena is a venue/platform — the real arrangers are hidden in descriptions and speaker info.
 *
 * Input:  tmp/ba-events-export.json
 * Output: tmp/ba-enrichment-review.json + tmp/ba-enrichment-review.md
 */

require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 15;
const DELAY_MS = 1000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllArrangers() {
  const all = [];
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('arrangers')
      .select('id, name, name_normalized')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Arrangers query failed: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  console.log(`Fetched ${all.length} arrangers from database`);
  return all;
}

async function fetchExistingLinks(eventIds) {
  // Fetch existing event_arrangers links so we can detect duplicates
  const { data, error } = await supabase
    .from('event_arrangers')
    .select('event_id, arranger_id')
    .in('event_id', eventIds);
  if (error) throw new Error(`event_arrangers query failed: ${error.message}`);
  return data || [];
}

function buildPrompt(batch) {
  const eventsText = batch.map(e => {
    const speakers = (e.speakers || [])
      .map(s => `  - ${s.name}${s.org ? ` (${s.org})` : ''}${s.title ? `, ${s.title}` : ''} [${s.role}]`)
      .join('\n');
    return `EVENT_ID: ${e.id}
YEAR: ${e.year}
TITLE: ${e.title}
DESCRIPTION: ${e.description || ''}
EXTENDED_DESCRIPTION: ${e.extended_description || ''}
SPEAKERS:
${speakers || '  (inga)'}`;
  }).join('\n\n---\n\n');

  return `Du är expert på svenska samhällsbyggnads- och fastighetsbranschen samt Almedalsveckan.

BAKGRUND: "Business Arena" är en eventplattform/arena, INTE den faktiska arrangören. Alla dessa events har Business Arena listad som arrangör, men den verkliga arrangören är en annan organisation. Din uppgift är att identifiera den faktiska arrangören.

LEDTRÅDAR att leta efter:
- "X presenterar" i titeln eller beskrivningen
- Talarnas organisationstillhörighet — om alla/de flesta kommer från samma org, är den troligen arrangör
- Specifika organisationsnamn nämnda i beskrivningen
- Branschorganisationer, fackförbund eller företag som nämns som värdar
- Kontaktpersonens organisation (om det inte är Business Arena)

VIKTIGT:
- Svara BARA med den organisation du tror är den verkliga arrangören
- Om du inte kan identifiera en tydlig arrangör, ange "okänd" och låg confidence
- Om det verkar vara Business Arenas eget öppningsevent eller liknande, ange "Business Arena" med en notis

Analysera följande ${batch.length} events och returnera ett JSON-array:

${eventsText}

Svara med ENBART ett JSON-array (ingen markdown, inga kommentarer):
[
  {
    "event_id": <number>,
    "identified_arranger": "<organisationsnamn>",
    "confidence": <0.0-1.0>,
    "reasoning": "<kort förklaring>"
  }
]`;
}

async function analyzeBatch(batch) {
  const prompt = buildPrompt(batch);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  // Try to extract JSON from the response
  let jsonText = text;
  // Strip markdown code fences if present
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    jsonText = jsonMatch[0];
  }
  return JSON.parse(jsonText);
}

function matchArranger(identifiedName, arrangers) {
  if (!identifiedName || identifiedName === 'okänd') return null;

  const lower = identifiedName.toLowerCase().trim();

  // Exact match on name or name_normalized
  let match = arrangers.find(a =>
    a.name.toLowerCase() === lower ||
    (a.name_normalized && a.name_normalized.toLowerCase() === lower)
  );
  if (match) return { ...match, match_type: 'exact' };

  // Partial: identified name is contained in DB name or vice versa
  match = arrangers.find(a => {
    const aLower = a.name.toLowerCase();
    const aNorm = (a.name_normalized || '').toLowerCase();
    return (aLower.includes(lower) || lower.includes(aLower) ||
            (aNorm && (aNorm.includes(lower) || lower.includes(aNorm))));
  });
  if (match) return { ...match, match_type: 'partial' };

  return null;
}

function classifyAction(result, dbMatch, existingLinks) {
  if (!dbMatch) return 'SKIP_NO_MATCH';

  // Check if this arranger is already linked to this event
  const isDuplicate = existingLinks.some(
    link => link.event_id === result.event_id && link.arranger_id === dbMatch.id
  );
  if (isDuplicate) return 'SKIP_DUPLICATE';

  if (result.confidence >= 0.8) return 'ADD';
  return 'NEEDS_REVIEW';
}

async function main() {
  // 1. Read events
  const eventsPath = path.join(__dirname, '..', 'tmp', 'ba-events-export.json');
  const events = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
  console.log(`Loaded ${events.length} Business Arena events`);

  // 2. Fetch all arrangers from DB
  const arrangers = await fetchAllArrangers();

  // 3. Fetch existing event_arrangers links
  const eventIds = events.map(e => e.id);
  const existingLinks = await fetchExistingLinks(eventIds);
  console.log(`Found ${existingLinks.length} existing event_arrangers links`);

  // 4. Process in batches
  const allResults = [];
  const batches = [];
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    batches.push(events.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`\nBatch ${i + 1}/${batches.length} (${batch.length} events)...`);
    try {
      const results = await analyzeBatch(batch);
      allResults.push(...results);
      console.log(`  → Got ${results.length} results`);
      for (const r of results) {
        console.log(`    ${r.event_id}: "${r.identified_arranger}" (${r.confidence})`);
      }
    } catch (err) {
      console.error(`  ✗ Batch ${i + 1} failed: ${err.message}`);
      // Add placeholder results for failed batch
      for (const e of batch) {
        allResults.push({
          event_id: e.id,
          identified_arranger: 'ERROR',
          confidence: 0,
          reasoning: `Batch failed: ${err.message}`,
        });
      }
    }
    if (i < batches.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // 5. Match and classify
  const eventsById = Object.fromEntries(events.map(e => [e.id, e]));
  const reviewItems = allResults.map(r => {
    const event = eventsById[r.event_id];
    const dbMatch = matchArranger(r.identified_arranger, arrangers);
    const action = classifyAction(r, dbMatch, existingLinks);

    return {
      event_id: r.event_id,
      year: event?.year,
      event_title: event?.title,
      identified_arranger: r.identified_arranger,
      confidence: r.confidence,
      reasoning: r.reasoning,
      db_match: dbMatch ? {
        id: dbMatch.id,
        name: dbMatch.name,
        name_normalized: dbMatch.name_normalized,
        match_type: dbMatch.match_type,
      } : null,
      action,
    };
  });

  // 6. Write JSON review
  const jsonOut = path.join(__dirname, '..', 'tmp', 'ba-enrichment-review.json');
  fs.writeFileSync(jsonOut, JSON.stringify(reviewItems, null, 2));
  console.log(`\nWrote ${jsonOut}`);

  // 7. Write markdown review
  const counts = { ADD: 0, NEEDS_REVIEW: 0, SKIP_NO_MATCH: 0, SKIP_DUPLICATE: 0 };
  reviewItems.forEach(r => { counts[r.action] = (counts[r.action] || 0) + 1; });

  const rows = reviewItems.map((r, i) => {
    const matchCol = r.db_match
      ? `✅ ${r.db_match.name} (id:${r.db_match.id})`
      : '❌';
    const title = (r.event_title || '').length > 50
      ? r.event_title.slice(0, 47) + '...'
      : r.event_title || '';
    return `| ${i + 1} | ${title} | ${r.year} | ${r.identified_arranger} | ${matchCol} | ${r.confidence} | ${r.action} |`;
  }).join('\n');

  const md = `# Business Arena Enrichment — Review

| # | Event | År | Föreslagen arrangör | Match i DB | Confidence | Action |
|---|-------|-----|---------------------|------------|------------|--------|
${rows}

## Sammanfattning
- ADD: ${counts.ADD} st
- NEEDS_REVIEW: ${counts.NEEDS_REVIEW} st
- SKIP_NO_MATCH: ${counts.SKIP_NO_MATCH} st
- SKIP_DUPLICATE: ${counts.SKIP_DUPLICATE} st
`;

  const mdOut = path.join(__dirname, '..', 'tmp', 'ba-enrichment-review.md');
  fs.writeFileSync(mdOut, md);
  console.log(`Wrote ${mdOut}`);

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`ADD: ${counts.ADD}`);
  console.log(`NEEDS_REVIEW: ${counts.NEEDS_REVIEW}`);
  console.log(`SKIP_NO_MATCH: ${counts.SKIP_NO_MATCH}`);
  console.log(`SKIP_DUPLICATE: ${counts.SKIP_DUPLICATE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

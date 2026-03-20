// Loads agent-parsed participant results into speakers + event_speakers
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NUM_FILES = parseInt(process.argv[2]) || 4;

async function fetchAllDB(table, columns) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from(table).select(columns).range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const all = [];

  for (let i = 1; i <= NUM_FILES; i++) {
    const file = `tmp/participants-result-${i}.json`;
    if (!fs.existsSync(file)) { console.error(`Missing: ${file}`); continue; }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    all.push(...data);
    console.log(`  ${file}: ${data.length} events`);
  }

  console.log(`Total: ${all.length} events`);

  // Map event_id+year -> db id
  const dbEvents = await fetchAllDB('events', 'id, source_id, year');
  const sourceMap = new Map();
  for (const e of dbEvents) {
    sourceMap.set(e.year + '_' + e.source_id, e.id);
  }

  let created = 0;
  let linked = 0;
  let skipped = 0;
  const speakerCache = new Map();

  for (let idx = 0; idx < all.length; idx++) {
    if (idx % 100 === 0) process.stdout.write(`\r  ${idx}/${all.length}`);

    const event = all[idx];
    if (!event.speakers?.length) continue;

    const dbId = sourceMap.get(event.year + '_' + event.event_id);
    if (!dbId) { skipped++; continue; }

    for (const sp of event.speakers) {
      if (!sp.name || sp.name.length < 3) continue;

      const normalized = sp.name.toLowerCase().trim();
      let speakerId = speakerCache.get(normalized);

      if (!speakerId) {
        const { data: existing } = await supabase
          .from('speakers')
          .select('id')
          .eq('name_normalized', normalized)
          .limit(1);

        if (existing?.length) {
          speakerId = existing[0].id;
        } else {
          const { data: inserted, error } = await supabase
            .from('speakers')
            .insert({
              name: sp.name,
              name_normalized: normalized,
              title: sp.title || null,
              org_name: sp.org || null,
            })
            .select('id');
          if (error) continue;
          if (inserted?.length) { speakerId = inserted[0].id; created++; }
        }
        if (speakerId) speakerCache.set(normalized, speakerId);
      }

      if (speakerId) {
        const { error } = await supabase
          .from('event_speakers')
          .upsert({
            event_id: dbId,
            speaker_id: speakerId,
            role: sp.role || 'panelist',
            raw_mention: sp.name,
          }, { onConflict: 'event_id,speaker_id', ignoreDuplicates: true });
        if (!error) linked++;
      }
    }
  }

  console.log(`\nDone: ${created} new speakers, ${linked} links, ${skipped} skipped`);

  const { count: ts } = await supabase.from('speakers').select('*', { count: 'exact', head: true });
  const { count: tl } = await supabase.from('event_speakers').select('*', { count: 'exact', head: true });
  console.log(`Total: ${ts} speakers, ${tl} links`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

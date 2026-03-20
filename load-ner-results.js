// Usage: node load-ner-results.js [numFiles]
// Loads NER results from tmp/ner-result-*.json into speakers + event_speakers tables
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NUM_FILES = parseInt(process.argv[2]) || 4;

async function main() {
  const all = [];

  for (let i = 1; i <= NUM_FILES; i++) {
    const file = `tmp/ner-result-${i}.json`;
    if (!fs.existsSync(file)) {
      console.error(`Missing: ${file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    all.push(...data);
    console.log(`  ${file}: ${data.length} events`);
  }

  console.log(`Total: ${all.length} events with speaker data`);

  let speakersCreated = 0;
  let linksCreated = 0;
  let skipped = 0;

  for (const event of all) {
    if (!event.speakers?.length) continue;

    for (const sp of event.speakers) {
      if (!sp.name || sp.name.length < 3) { skipped++; continue; }

      const normalized = sp.name.toLowerCase().trim();

      // Find or create speaker
      let { data: existing } = await supabase
        .from('speakers')
        .select('id')
        .eq('name_normalized', normalized)
        .limit(1);

      let speakerId;
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
        if (error) {
          console.error(`Speaker insert error for "${sp.name}":`, error.message);
          continue;
        }
        if (inserted?.length) {
          speakerId = inserted[0].id;
          speakersCreated++;
        }
      }

      if (speakerId) {
        const { error } = await supabase
          .from('event_speakers')
          .upsert({
            event_id: event.event_id,
            speaker_id: speakerId,
            role: sp.role || 'okänt',
            raw_mention: sp.name,
          }, { onConflict: 'event_id,speaker_id', ignoreDuplicates: true });

        if (error) {
          // Ignore duplicate key errors silently
          if (!error.message.includes('duplicate')) {
            console.error(`Link error:`, error.message);
          }
        } else {
          linksCreated++;
        }
      }
    }
  }

  console.log(`Done: ${speakersCreated} new speakers, ${linksCreated} links, ${skipped} skipped`);

  // Check totals
  const { count: totalSpeakers } = await supabase.from('speakers').select('*', { count: 'exact', head: true });
  const { count: totalLinks } = await supabase.from('event_speakers').select('*', { count: 'exact', head: true });
  console.log(`Total in DB: ${totalSpeakers} speakers, ${totalLinks} event_speaker links`);
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapping: topic_pdf_original → topic_primary (kluster)
const TOPIC_MAP = {
  'Hållbarhet': 'klimat_miljö_hållbarhet',
  'Byggande': 'bostäder_samhällsbyggnad',
  'Säkerhet/försvar': 'försvar_säkerhet',
  'Demokrati': 'demokrati_rättsstat',
  'Vård och omsorg': 'hälsa_sjukvård',
  'Vård och Omsorg': 'hälsa_sjukvård',
  'Energi': 'energi',
  'Barn/ungdom': 'barn_ungdom',
  'Ekonomi': 'ekonomi_tillväxt',
  'Digitalisering': 'digitalisering_ai',
  'Utbildning': 'skola_utbildning_forskning',
  'Klimat/miljö': 'klimat_miljö_hållbarhet',
  'Infrastruktur/kommunikationer': 'transport_infrastruktur',
  'Näringsliv': 'näringsliv_innovation',
  'Forskning': 'skola_utbildning_forskning',
  'Sysselsättning/arbetsmarknad': 'arbetsmarknad_löner',
  'Innovation': 'näringsliv_innovation',
  'Mänskliga rättigheter': 'demokrati_rättsstat',
  'Internationella frågor': 'eu_utrikespolitik',
  'Rättsväsende/brott': 'demokrati_rättsstat',
  'Partiets halvdag': 'övrigt',
  'Kultur': 'kultur_idrott',
  'Media/journalistik': 'media_kommunikation',
  'Djur/natur': 'klimat_miljö_hållbarhet',
  'Jämställdhet': 'jämställdhet_mångfald',
  'Annat': 'övrigt',
  'Integration/mångfald': 'integration_migration',
  'Mänskliga': 'demokrati_rättsstat',
  'Kommunikation/information': 'media_kommunikation',
  'Regionfrågor': 'övrigt',
  'Mat': 'övrigt',
  'EU': 'eu_utrikespolitik',
  'Religion': 'övrigt',
  'Internationella': 'eu_utrikespolitik',
  'Äldre': 'välfärd_omsorg',
  'Besöksnäring': 'näringsliv_innovation',
  'Yttrandefrihet': 'demokrati_rättsstat',
  'Internationella frågo': 'eu_utrikespolitik',
  'Internationella frå': 'eu_utrikespolitik',
  'Mänskliga rättighete': 'demokrati_rättsstat',
};

// Same mapping for secondary topics
const SECONDARY_MAP = { ...TOPIC_MAP };

// Paginated fetch
async function fetchAll(table, columns) {
  const rows = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + step - 1);
    if (error) throw new Error(`fetchAll ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < step) break;
    from += step;
  }
  return rows;
}

async function main() {
  console.log('Fetching all events...');
  const events = await fetchAll('events', 'id, topic_pdf_original, secondary_topic');
  console.log(`Got ${events.length} events.`);

  const rows = [];
  let unmapped = new Set();

  for (const e of events) {
    const primary = TOPIC_MAP[e.topic_pdf_original] || null;
    if (e.topic_pdf_original && !primary) {
      unmapped.add(e.topic_pdf_original);
    }

    // Map secondary topic
    const secTopics = [];
    if (e.secondary_topic) {
      const mapped = SECONDARY_MAP[e.secondary_topic];
      if (mapped && mapped !== primary) {
        secTopics.push(mapped);
      }
    }

    rows.push({
      event_id: e.id,
      topic_primary: primary || 'övrigt',
      topic_secondary: secTopics,
      keywords: [],
      confidence: primary ? 1.0 : 0.5,
    });
  }

  if (unmapped.size > 0) {
    console.log('Unmapped topics:', [...unmapped]);
  }

  // Insert in batches
  console.log(`Inserting ${rows.length} topic mappings...`);
  const BATCH = 200;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    process.stdout.write(`\rTopics: ${Math.min(i + BATCH, rows.length)}/${rows.length}`);

    const { error } = await supabase
      .from('event_topics')
      .upsert(batch, { onConflict: 'event_id', ignoreDuplicates: false });

    if (error) {
      console.error(`\nBatch error at ${i}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\nInserted ${inserted} topic mappings.`);

  // Stats
  const stats = {};
  for (const r of rows) {
    stats[r.topic_primary] = (stats[r.topic_primary] || 0) + 1;
  }
  const sorted = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  console.log('\n=== Fördelning per kluster ===');
  sorted.forEach(([k, v]) => console.log(`  ${v.toString().padStart(5)}  ${k}`));
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

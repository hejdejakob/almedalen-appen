// Usage: node merge-and-load-sentiment.js [numFiles]
// Merges sentiment-result-1.json through sentiment-result-N.json and loads into Supabase
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const NUM_FILES = parseInt(process.argv[2]) || 4;

async function main() {
  const all = [];

  for (let i = 1; i <= NUM_FILES; i++) {
    const file = `tmp/sentiment-result-${i}.json`;
    if (!fs.existsSync(file)) {
      console.error(`Missing: ${file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    all.push(...data);
    console.log(`  ${file}: ${data.length} results`);
  }

  console.log(`Total: ${all.length} results to load`);

  // Validate and clean
  const valid = all.filter(r => {
    if (!r.event_id) { console.error('Missing event_id:', r); return false; }
    r.score = Math.max(-1, Math.min(1, r.score || 0));
    r.label = ['positiv', 'neutral', 'negativ'].includes(r.label) ? r.label : 'neutral';
    r.urgency_score = Math.max(0, Math.min(1, r.urgency_score || 0));
    r.framing = ['problem', 'solution', 'neutral'].includes(r.framing) ? r.framing : 'neutral';
    r.confidence = r.confidence || 0.8;
    return true;
  });

  console.log(`Valid: ${valid.length}`);

  // Upsert in batches of 200
  const BATCH = 200;
  let loaded = 0;
  for (let i = 0; i < valid.length; i += BATCH) {
    const batch = valid.slice(i, i + BATCH);
    const { error } = await supabase
      .from('event_sentiment')
      .upsert(batch, { onConflict: 'event_id' });

    if (error) {
      console.error(`Batch error:`, error.message);
    } else {
      loaded += batch.length;
    }
  }

  console.log(`Loaded: ${loaded} sentiment rows`);

  // Check total
  const { count } = await supabase.from('event_sentiment').select('*', { count: 'exact', head: true });
  console.log(`Total in DB: ${count}`);
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });

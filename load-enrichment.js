// Usage: node load-enrichment.js <table> <file> [conflictColumn]
// Example: node load-enrichment.js event_sentiment tmp/sentiment-batch-1.json event_id
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TABLE = process.argv[2];
const FILE = process.argv[3];
const CONFLICT = process.argv[4] || 'event_id';

async function main() {
  if (!TABLE || !FILE) {
    console.error('Usage: node load-enrichment.js <table> <file> [conflictColumn]');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  console.log(`Loading ${data.length} rows into ${TABLE} from ${FILE}...`);

  // Upsert in batches of 200
  const BATCH = 200;
  let loaded = 0;
  let errors = 0;

  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const { error } = await supabase
      .from(TABLE)
      .upsert(batch, { onConflict: CONFLICT });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
      errors++;
    } else {
      loaded += batch.length;
    }
  }

  console.log(`Done: ${loaded} loaded, ${errors} batch errors.`);
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });

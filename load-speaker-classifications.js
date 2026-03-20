// Load speaker classifications from tmp/speaker-classifications.json into Supabase
// Usage: node load-speaker-classifications.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_CATEGORIES = [
  'politiker', 'näringsliv', 'konsult_pr', 'facklig',
  'arbetsgivar_branschorg', 'civilsamhälle', 'tankesmedja',
  'media', 'akademi', 'offentlig_sektor'
];

async function main() {
  const filePath = path.join(__dirname, 'tmp', 'speaker-classifications.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  console.log(`Loaded ${data.length} classifications`);

  // Validate
  const valid = [];
  const invalid = [];
  for (const item of data) {
    if (!item.id || !item.category) {
      invalid.push(item);
      continue;
    }
    if (!VALID_CATEGORIES.includes(item.category)) {
      invalid.push(item);
      continue;
    }
    valid.push({
      speaker_id: item.id,
      category: item.category,
      confidence: item.confidence || 0.8,
      method: 'claude',
    });
  }

  if (invalid.length > 0) {
    console.log(`WARNING: ${invalid.length} invalid entries skipped`);
    console.log('Examples:', invalid.slice(0, 5));
  }

  // Upsert in batches of 100
  let loaded = 0;
  for (let i = 0; i < valid.length; i += 100) {
    const batch = valid.slice(i, i + 100);
    const { error } = await supabase
      .from('speaker_classifications')
      .upsert(batch, { onConflict: 'speaker_id' });
    if (error) {
      console.error(`Error at batch ${i}:`, error.message);
    } else {
      loaded += batch.length;
    }
  }

  console.log(`\nLoaded ${loaded} classifications into speaker_classifications`);

  // Stats per category
  const stats = {};
  for (const item of valid) {
    stats[item.category] = (stats[item.category] || 0) + 1;
  }
  console.log('\nPer kategori:');
  for (const [cat, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Confidence stats
  const lowConf = valid.filter(v => v.confidence < 0.8).length;
  console.log(`\nLåg tillförlitlighet (<0.8): ${lowConf}`);
}

main().catch(console.error);

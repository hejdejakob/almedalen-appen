// Usage: node fetch-sentiment-batch.js <batchNumber> <eventsPerBatch>
// Fetches the next batch of events that need sentiment analysis
// Default: 200 events per batch, split into 4 files of 50 for agent processing
require('dotenv').config();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BATCH_NUM = parseInt(process.argv[2]) || 1;
const EVENTS_PER_BATCH = parseInt(process.argv[3]) || 200;
const AGENT_BATCH_SIZE = 50;

async function fetchAll(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  // Get all event IDs that already have sentiment
  const existing = await fetchAll('event_sentiment', 'event_id');
  const done = new Set(existing.map(r => r.event_id));

  // Get all events
  const allEvents = await fetchAll('events', 'id, title, description');
  const todo = allEvents.filter(e => !done.has(e.id));

  console.log(`Total remaining: ${todo.length} events`);

  // Get this batch
  const start = (BATCH_NUM - 1) * EVENTS_PER_BATCH;
  const batch = todo.slice(start, start + EVENTS_PER_BATCH);

  if (batch.length === 0) {
    console.log('No more events to process!');
    return;
  }

  console.log(`Batch ${BATCH_NUM}: ${batch.length} events (starting at offset ${start})`);

  // Split into agent-sized sub-batches
  for (let i = 0; i < batch.length; i += AGENT_BATCH_SIZE) {
    const sub = batch.slice(i, i + AGENT_BATCH_SIZE);
    const n = Math.floor(i / AGENT_BATCH_SIZE) + 1;
    fs.writeFileSync(`tmp/sentiment-input-${n}.json`, JSON.stringify(sub, null, 2));
    console.log(`  Sub-batch ${n}: ${sub.length} events`);
  }
}

main().catch(err => { console.error('Failed:', err.message); process.exit(1); });

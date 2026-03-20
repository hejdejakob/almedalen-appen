require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DATA_PATH = path.join(__dirname, 'public', 'almedalen-all.json');
const BATCH_SIZE = 200;

function parseTime(date, time) {
  if (!date || !time) return null;
  // date: "2025-06-23", time: "07:00"
  return `${date}T${time}:00+02:00`; // Swedish summer time (CEST)
}

function transformEvent(raw) {
  return {
    source_id: raw.event_id || null,
    year: raw.year,
    title: raw.title || '',
    description: raw.description || '',
    extended_description: raw.extended_description || '',
    start_time: parseTime(raw.date, raw.start_time),
    end_time: parseTime(raw.date, raw.end_time),
    day_of_week: raw.day_of_week || '',
    location_name: raw.location || null,
    event_type: raw.event_type || '',
    topic_pdf_original: raw.topic || '',
    secondary_topic: raw.secondary_topic || '',
    language: raw.language || 'Svenska',
    refreshments: raw.refreshments === true,
    url: raw.url || '',
    source: raw.source || 'scraper',
    raw_text: JSON.stringify(raw),
  };
}

async function ingestEvents(events) {
  console.log(`Ingesting ${events.length} events in batches of ${BATCH_SIZE}...`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE).map(transformEvent);
    process.stdout.write(`\rEvents: ${Math.min(i + BATCH_SIZE, events.length)}/${events.length}`);

    const { data, error } = await supabase
      .from('events')
      .upsert(batch, { onConflict: 'year,source_id' })
      .select('id');

    if (error) {
      console.error(`\nBatch error at ${i}:`, error.message);
      errors++;
    } else {
      inserted += data.length;
    }
  }

  console.log(`\nInserted/updated ${inserted} events (${errors} batch errors).`);
  return inserted;
}

async function ingestArrangers(events) {
  // Collect unique organizers across all events
  const arrangerMap = new Map(); // name -> first_seen_year

  for (const event of events) {
    if (!event.organizer) continue;
    // Keep full organizer string — commas are often part of the name
    // Splitting/normalizing is done in Fas 2 (arrangörsnormalisering)
    const name = event.organizer.trim();
    const existing = arrangerMap.get(name);
    if (!existing || event.year < existing) {
      arrangerMap.set(name, event.year);
    }
  }

  console.log(`Found ${arrangerMap.size} unique arrangers.`);

  const arrangers = [...arrangerMap.entries()].map(([name, year]) => ({
    name,
    name_normalized: name.toLowerCase().trim(),
    first_seen_year: year,
  }));

  // Upsert in batches
  let inserted = 0;
  for (let i = 0; i < arrangers.length; i += BATCH_SIZE) {
    const batch = arrangers.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\rArrangers: ${Math.min(i + BATCH_SIZE, arrangers.length)}/${arrangers.length}`);

    const { data, error } = await supabase
      .from('arrangers')
      .upsert(batch, { onConflict: 'name_normalized', ignoreDuplicates: true })
      .select('id');

    if (error) {
      // name_normalized has no unique constraint yet, insert individually
      for (const a of batch) {
        const { data: existing } = await supabase
          .from('arrangers')
          .select('id')
          .eq('name_normalized', a.name_normalized)
          .limit(1);

        if (!existing?.length) {
          await supabase.from('arrangers').insert(a);
          inserted++;
        }
      }
    } else {
      inserted += data?.length || 0;
    }
  }

  console.log(`\nInserted ${inserted} arrangers.`);
}

// Paginated fetch — Supabase caps at 1000 rows per request
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

async function linkEventArrangers(events) {
  console.log('Linking events to arrangers...');

  // Get ALL arrangers from DB (paginated)
  const allArrangers = await fetchAll('arrangers', 'id, name_normalized');
  console.log(`Fetched ${allArrangers.length} arrangers from DB.`);

  const arrangerLookup = new Map();
  for (const a of allArrangers) {
    arrangerLookup.set(a.name_normalized, a.id);
  }

  // Get ALL events from DB (paginated)
  const allEvents = await fetchAll('events', 'id, source_id, year');
  console.log(`Fetched ${allEvents.length} events from DB.`);

  const eventLookup = new Map();
  for (const e of allEvents) {
    eventLookup.set(`${e.year}_${e.source_id}`, e.id);
  }

  const links = [];
  let noEvent = 0, noArranger = 0;

  for (const event of events) {
    if (!event.organizer) continue;
    const eventId = eventLookup.get(`${event.year}_${event.event_id}`);
    if (!eventId) { noEvent++; continue; }

    // Use full organizer string as-is for lookup (don't split on comma —
    // commas are often part of the name)
    const orgFull = event.organizer.trim().toLowerCase();
    const arrangerId = arrangerLookup.get(orgFull);
    if (arrangerId) {
      links.push({ event_id: eventId, arranger_id: arrangerId, is_primary: true });
    } else {
      noArranger++;
    }
  }

  console.log(`Creating ${links.length} event-arranger links...`);

  let linked = 0;
  for (let i = 0; i < links.length; i += BATCH_SIZE) {
    const batch = links.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\rLinks: ${Math.min(i + BATCH_SIZE, links.length)}/${links.length}`);

    const { error } = await supabase
      .from('event_arrangers')
      .upsert(batch, { onConflict: 'event_id,arranger_id', ignoreDuplicates: true });

    if (!error) linked += batch.length;
  }

  console.log(`\nLinked ${linked} event-arranger pairs.`);
}

async function main() {
  console.log('Loading data...');
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

  // Handle both array and object-with-numeric-keys format
  const allEvents = Array.isArray(raw) ? raw : Object.values(raw);
  console.log(`Loaded ${allEvents.length} events (raw).`);

  // Deduplicate by year + event_id (keep last occurrence)
  const deduped = new Map();
  for (const e of allEvents) {
    deduped.set(`${e.year}_${e.event_id}`, e);
  }
  const events = [...deduped.values()];
  console.log(`After dedup: ${events.length} events (removed ${allEvents.length - events.length} duplicates).`);

  // Count per year
  const years = {};
  events.forEach(e => { years[e.year] = (years[e.year] || 0) + 1; });
  console.log('Per year:', years);

  await ingestEvents(events);
  await ingestArrangers(events);
  await linkEventArrangers(events);

  // Verify
  const { count: eventCount } = await supabase.from('events').select('*', { count: 'exact', head: true });
  const { count: arrangerCount } = await supabase.from('arrangers').select('*', { count: 'exact', head: true });
  const { count: linkCount } = await supabase.from('event_arrangers').select('*', { count: 'exact', head: true });

  console.log('\n=== Verification ===');
  console.log(`Events in DB: ${eventCount}`);
  console.log(`Arrangers in DB: ${arrangerCount}`);
  console.log(`Event-arranger links: ${linkCount}`);
}

main().catch(err => {
  console.error('Ingest failed:', err);
  process.exit(1);
});

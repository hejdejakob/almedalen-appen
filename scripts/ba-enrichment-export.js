#!/usr/bin/env node
/**
 * Export Business Arena events from Supabase (2022–2025) with speakers and arrangers.
 * Output: tmp/ba-events-export.json
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // 1. Fetch Business Arena events (paginated to handle >1000 rows)
  const years = [2022, 2023, 2024, 2025];
  let allEvents = [];
  const PAGE_SIZE = 1000;

  for (const year of years) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('id, year, title, description, extended_description, location_name')
        .eq('year', year)
        .ilike('location_name', '%Business Arena%')
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw new Error(`Events query failed: ${error.message}`);
      if (!data || data.length === 0) break;
      allEvents = allEvents.concat(data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  console.log(`Fetched ${allEvents.length} Business Arena events`);

  // 2. For each event, fetch speakers and arrangers
  const eventIds = allEvents.map(e => e.id);

  // Fetch all event_speakers + speakers in bulk
  const { data: speakerLinks, error: spErr } = await supabase
    .from('event_speakers')
    .select('event_id, role, speakers(name, org_name, title)')
    .in('event_id', eventIds);

  if (spErr) throw new Error(`Speaker query failed: ${spErr.message}`);

  // Fetch all event_arrangers + arrangers in bulk
  const { data: arrangerLinks, error: arErr } = await supabase
    .from('event_arrangers')
    .select('event_id, arrangers(id, name)')
    .in('event_id', eventIds);

  if (arErr) throw new Error(`Arranger query failed: ${arErr.message}`);

  // Index by event_id
  const speakersByEvent = {};
  for (const sl of (speakerLinks || [])) {
    if (!speakersByEvent[sl.event_id]) speakersByEvent[sl.event_id] = [];
    speakersByEvent[sl.event_id].push({
      role: sl.role,
      name: sl.speakers?.name || null,
      org: sl.speakers?.org_name || null,
      title: sl.speakers?.title || null,
    });
  }

  const arrangersByEvent = {};
  for (const al of (arrangerLinks || [])) {
    if (!arrangersByEvent[al.event_id]) arrangersByEvent[al.event_id] = [];
    arrangersByEvent[al.event_id].push({
      id: al.arrangers?.id || null,
      name: al.arrangers?.name || null,
    });
  }

  // 3. Build output
  const output = allEvents.map(e => ({
    id: e.id,
    year: e.year,
    title: e.title,
    description: e.description,
    extended_description: e.extended_description,
    location_name: e.location_name,
    current_arrangers: arrangersByEvent[e.id] || [],
    speakers: speakersByEvent[e.id] || [],
  }));

  // 4. Write to file
  const outPath = path.join(__dirname, '..', 'tmp', 'ba-events-export.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Wrote ${output.length} events to ${outPath}`);

  // Per-year breakdown
  const byYear = {};
  for (const e of output) {
    byYear[e.year] = (byYear[e.year] || 0) + 1;
  }
  console.log('Per year:', byYear);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

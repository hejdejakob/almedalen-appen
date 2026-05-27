// Regenerates public/almedalen-all.json by combining historical years
// (2022-2025) from the existing all-file with fresh 2026 data from
// public/almedalen-2026.json.
//
// Field mapping from per-year format to the combined-format:
//   id          -> event_id
//   day         -> day_of_week
//   (no year)   -> year (set from filename)
//   tags        -> tags (kept)
//   refreshments boolean stays as-is
//
// participants is set to [] for 2026 — speaker scraping is a separate
// later pipeline (closer to June).

const fs = require('fs');
const path = require('path');

const ALL_PATH = path.join(__dirname, 'public', 'almedalen-all.json');
const Y2026_PATH = path.join(__dirname, 'public', 'almedalen-2026.json');

function mapNewToCombined(newEvent, year) {
  return {
    year: year,
    event_id: newEvent.id,
    title: newEvent.title || '',
    date: newEvent.date || '',
    start_time: newEvent.start_time || '',
    end_time: newEvent.end_time || '',
    day_of_week: newEvent.day || '',
    topic: newEvent.topic || '',
    secondary_topic: newEvent.secondary_topic || '',
    event_type: newEvent.event_type || '',
    location: newEvent.location || '',
    organizer: newEvent.organizer || '',
    participants: [],
    description: newEvent.description || '',
    extended_description: newEvent.extended_description || '',
    language: newEvent.language || 'Svenska',
    refreshments: newEvent.refreshments === true,
    url: newEvent.url || '',
    tags: newEvent.tags || [],
    source: 'scraper',
  };
}

function main() {
  console.log('Reading combined file...');
  const allOld = JSON.parse(fs.readFileSync(ALL_PATH, 'utf8'));
  console.log(`  ${allOld.length} events across all years`);

  const before = {};
  for (const e of allOld) {
    before[e.year] = (before[e.year] || 0) + 1;
  }
  console.log('  Per year (before):', before);

  console.log('Reading 2026 snapshot...');
  const new2026 = JSON.parse(fs.readFileSync(Y2026_PATH, 'utf8'));
  console.log(`  scraped_at: ${new2026.scraped_at}`);
  console.log(`  events: ${new2026.events.length}`);

  // Keep everything except year 2026, then append new 2026.
  const kept = allOld.filter(e => e.year !== 2026);
  console.log(`Kept ${kept.length} non-2026 events.`);

  const newRows = new2026.events.map(e => mapNewToCombined(e, 2026));
  const merged = [...kept, ...newRows];

  const after = {};
  for (const e of merged) {
    after[e.year] = (after[e.year] || 0) + 1;
  }
  console.log('Per year (after):', after);
  console.log(`Total: ${merged.length} events.`);

  fs.writeFileSync(ALL_PATH, JSON.stringify(merged, null, 0));
  const stat = fs.statSync(ALL_PATH);
  console.log(`Wrote ${ALL_PATH} (${stat.size.toLocaleString()} bytes).`);
}

main();

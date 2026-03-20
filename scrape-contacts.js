// Scrapes contactPerson data from Almedalen event detail pages
// and saves to speakers + event_speakers tables
const { chromium } = require('playwright');
const fs = require('fs');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CONCURRENCY = 10;
const YEAR = parseInt(process.argv[2]) || 2026;

async function fetchAllDB(table, columns, filter) {
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

async function scrapeDetailBatch(browser, events) {
  const results = [];
  const pages = await Promise.all(events.map(() => browser.newPage()));

  await Promise.all(events.map(async (event, i) => {
    const pg = pages[i];
    try {
      await pg.goto(event.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const data = await pg.evaluate(() => {
        const scripts = [...document.querySelectorAll('script')];
        for (const s of scripts) {
          const matches = [...s.textContent.matchAll(/registerInitialState\('([^']+)',\s*(\{[\s\S]*?\})\s*\)/g)];
          for (const m of matches) {
            try {
              const data = JSON.parse(m[2]);
              if (data.eventId) return {
                contactPerson1: data.contactPerson1 || null,
                contactPerson2: data.contactPerson2 || null,
              };
            } catch {}
          }
        }
        return null;
      });

      if (data) {
        const contacts = [];
        if (data.contactPerson1?.name) contacts.push(data.contactPerson1);
        if (data.contactPerson2?.name) contacts.push(data.contactPerson2);
        if (contacts.length > 0) {
          results.push({ event_id: event.db_id, source_id: event.source_id, contacts });
        }
      }
    } catch (err) {
      // Skip errors
    } finally {
      await pg.close();
    }
  }));

  return results;
}

async function main() {
  // Load JSON data for URLs
  const jsonFile = `./public/almedalen-${YEAR}.json`;
  const jsonData = require(jsonFile);
  const jsonEvents = jsonData.events;
  console.log(`Loaded ${jsonEvents.length} events from ${jsonFile}`);

  // Get DB event IDs to map source_id -> db_id
  const dbEvents = await fetchAllDB('events', 'id, source_id', q => q.eq('year', YEAR));
  const sourceToDb = new Map(dbEvents.map(e => [e.source_id, e.id]));
  console.log(`DB has ${dbEvents.length} events for ${YEAR}`);

  // Build list of events to scrape
  const toScrape = jsonEvents
    .filter(e => e.url && sourceToDb.has(e.id))
    .map(e => ({ url: e.url, source_id: e.id, db_id: sourceToDb.get(e.id) }));

  console.log(`Will scrape ${toScrape.length} event pages for contact persons...`);

  const browser = await chromium.launch({ headless: true });
  const allContacts = [];

  for (let i = 0; i < toScrape.length; i += CONCURRENCY) {
    const batch = toScrape.slice(i, i + CONCURRENCY);
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, toScrape.length)}/${toScrape.length}`);
    const results = await scrapeDetailBatch(browser, batch);
    allContacts.push(...results);
  }

  await browser.close();
  console.log(`\nFound contact persons for ${allContacts.length} events`);

  // Save raw results
  fs.writeFileSync(`tmp/contacts-${YEAR}.json`, JSON.stringify(allContacts, null, 2));

  // Load into speakers + event_speakers
  let speakersCreated = 0;
  let linksCreated = 0;

  for (const event of allContacts) {
    for (const contact of event.contacts) {
      if (!contact.name || contact.name.length < 3) continue;

      const normalized = contact.name.toLowerCase().trim();

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
            name: contact.name,
            name_normalized: normalized,
            title: contact.title || null,
            org_name: contact.org || null,
          })
          .select('id');
        if (error) continue;
        if (inserted?.length) { speakerId = inserted[0].id; speakersCreated++; }
      }

      if (speakerId) {
        const { error } = await supabase
          .from('event_speakers')
          .upsert({
            event_id: event.event_id,
            speaker_id: speakerId,
            role: 'kontaktperson',
            raw_mention: contact.name,
          }, { onConflict: 'event_id,speaker_id', ignoreDuplicates: true });
        if (!error) linksCreated++;
      }
    }
  }

  console.log(`Created ${speakersCreated} new speakers, ${linksCreated} links`);

  const { count: totalSpeakers } = await supabase.from('speakers').select('*', { count: 'exact', head: true });
  const { count: totalLinks } = await supabase.from('event_speakers').select('*', { count: 'exact', head: true });
  console.log(`Total: ${totalSpeakers} speakers, ${totalLinks} links`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

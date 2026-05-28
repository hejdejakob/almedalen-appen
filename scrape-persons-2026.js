// Scrapes the 'persons' field from each 2026 event detail page
// The main scraper missed this field - it contains structured speaker data
const { chromium } = require('playwright');
const fs = require('fs');

const EVENT_BASE_URL = 'https://almedalsveckan.info/rg/almedalsveckan/evenemang-almedalsveckan/2026';
const CONCURRENCY = 10;

async function scrapePersons(browser, eventId) {
  const page = await browser.newPage();
  try {
    await page.goto(`${EVENT_BASE_URL}/${eventId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const persons = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll('script')];
      for (const s of scripts) {
        const matches = [...s.textContent.matchAll(/registerInitialState\('([^']+)',\s*(\{[\s\S]*?\})\s*\)/g)];
        for (const m of matches) {
          try {
            const data = JSON.parse(m[2]);
            if (data.eventId && data.persons) return data.persons;
          } catch {}
        }
      }
      return null;
    });

    return persons;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

async function main() {
  const events = require('./public/almedalen-2026.json').events;
  console.log(`Scraping persons for ${events.length} events...`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let withPersons = 0;
  let totalPersons = 0;

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    process.stdout.write(`\r  ${i}/${events.length} (${withPersons} events with persons, ${totalPersons} total persons)`);

    const promises = batch.map(async (event) => {
      const persons = await scrapePersons(browser, event.id);
      const filtered = (persons || []).filter(p => p && p.name);
      if (filtered.length > 0) {
        withPersons++;
        totalPersons += filtered.length;
        results.push({
          event_id: String(event.id),
          year: 2026,
          speakers: filtered.map(p => ({
            name: p.name,
            title: p.title || '',
            org: p.organization || '',
            role: 'panelist',
          })),
        });
      }
    });

    await Promise.all(promises);

    // Small delay every 100 events
    if (i % 100 === 0 && i > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  await browser.close();

  console.log(`\nDone: ${results.length} events with persons, ${totalPersons} total persons`);
  fs.writeFileSync('tmp/persons-2026-scraped.json', JSON.stringify(results, null, 2));
  console.log('Saved to tmp/persons-2026-scraped.json');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

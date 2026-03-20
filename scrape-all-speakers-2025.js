// Scrapes contactPerson1, contactPerson2, and persons from ALL 2025 event detail pages
// Uses smaller concurrency and delays to avoid rate limiting
const { chromium } = require('playwright');
const fs = require('fs');

const EVENT_BASE_URL = 'https://almedalsveckan.info/rg/almedalsveckan/evenemang-almedalsveckan/2025';
const CONCURRENCY = 5; // Lower to avoid rate limits
const DELAY_BETWEEN_BATCHES = 1000; // 1s between batches

async function scrapeEvent(browser, eventId) {
  const page = await browser.newPage();
  try {
    await page.goto(`${EVENT_BASE_URL}/${eventId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    const data = await page.evaluate(() => {
      const scripts = [...document.querySelectorAll('script')];
      for (const s of scripts) {
        const matches = [...s.textContent.matchAll(/registerInitialState\('([^']+)',\s*(\{[\s\S]*?\})\s*\)/g)];
        for (const m of matches) {
          try {
            const d = JSON.parse(m[2]);
            if (d.eventId) return {
              contactPerson1: d.contactPerson1 || null,
              contactPerson2: d.contactPerson2 || null,
              persons: d.persons || null,
            };
          } catch {}
        }
      }
      return null;
    });

    return data;
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

function parseContact(cp) {
  if (!cp) return null;
  if (typeof cp === 'object' && cp.name && cp.name.trim().length > 2) {
    return { name: cp.name.trim(), title: cp.title || '', org: cp.organization || '', role: 'contact' };
  }
  return null;
}

async function main() {
  // Load already-scraped results to skip
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync('tmp/all-2025-speakers.json', 'utf-8')); } catch {}
  const doneIds = new Set(existing.map(e => e.event_id));

  const events = require('./public/almedalen-2025.json').events;
  const remaining = events.filter(e => !doneIds.has(String(e.id)));
  console.log(`Total: ${events.length}, Already done: ${doneIds.size}, Remaining: ${remaining.length}`);

  const browser = await chromium.launch({ headless: true });
  const results = [...existing];
  let newContacts = 0, newPersons = 0, failures = 0;

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (event) => {
      const data = await scrapeEvent(browser, event.id);
      if (!data) { failures++; return; }

      const speakers = [];
      const c1 = parseContact(data.contactPerson1);
      const c2 = parseContact(data.contactPerson2);
      if (c1) { speakers.push(c1); newContacts++; }
      if (c2) { speakers.push(c2); newContacts++; }

      const persons = (data.persons || []).filter(p => p && p.name);
      for (const p of persons) {
        speakers.push({ name: p.name, title: p.title || '', org: p.organization || '', role: 'panelist' });
        newPersons++;
      }

      if (speakers.length > 0) {
        results.push({ event_id: String(event.id), year: 2025, speakers });
      }
    });

    await Promise.all(promises);

    if (i % 50 === 0) {
      process.stdout.write(`\r  ${i}/${remaining.length} (+${newContacts} contacts, +${newPersons} persons, ${failures} failures)`);
    }

    // Save progress every 200 events
    if (i % 200 === 0 && i > 0) {
      fs.writeFileSync('tmp/all-2025-speakers.json', JSON.stringify(results, null, 2));
    }

    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
  }

  await browser.close();

  fs.writeFileSync('tmp/all-2025-speakers.json', JSON.stringify(results, null, 2));
  console.log(`\nDone: ${results.length} events total, +${newContacts} contacts, +${newPersons} persons, ${failures} failures`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

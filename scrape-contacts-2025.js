// Scrapes contactPerson1 + contactPerson2 from ALL 2025 event detail pages
const { chromium } = require('playwright');
const fs = require('fs');

const EVENT_BASE_URL = 'https://almedalsveckan.info/rg/almedalsveckan/evenemang-almedalsveckan/2025';
const CONCURRENCY = 10;

async function scrapeContacts(browser, eventId) {
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
            const data = JSON.parse(m[2]);
            if (data.eventId) return {
              contactPerson1: data.contactPerson1 || null,
              contactPerson2: data.contactPerson2 || null,
              persons: data.persons || null,
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
  // contactPerson can be an object with name, title, organization, phone, email
  // or sometimes a string
  if (typeof cp === 'string') {
    // Try to parse "Name, Title, Org, phone, email"
    const parts = cp.split(',').map(s => s.trim());
    if (parts.length >= 1 && parts[0].length > 2) {
      return { name: parts[0], title: parts[1] || '', org: parts[2] || '' };
    }
    return null;
  }
  if (cp.name && cp.name.trim().length > 2) {
    return { name: cp.name.trim(), title: cp.title || '', org: cp.organization || '' };
  }
  return null;
}

async function main() {
  const events = require('./public/almedalen-2025.json').events;
  console.log(`Scraping contacts+persons for ${events.length} events...`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let contactCount = 0;
  let personsCount = 0;

  for (let i = 0; i < events.length; i += CONCURRENCY) {
    const batch = events.slice(i, i + CONCURRENCY);
    process.stdout.write(`\r  ${i}/${events.length} (${contactCount} contacts, ${personsCount} persons)`);

    const promises = batch.map(async (event) => {
      const data = await scrapeContacts(browser, event.id);
      if (!data) return;

      const speakers = [];

      // Parse contact persons
      const c1 = parseContact(data.contactPerson1);
      const c2 = parseContact(data.contactPerson2);
      if (c1) { speakers.push({ ...c1, role: 'contact' }); contactCount++; }
      if (c2) { speakers.push({ ...c2, role: 'contact' }); contactCount++; }

      // Parse persons (medverkande)
      const persons = (data.persons || []).filter(p => p && p.name);
      for (const p of persons) {
        speakers.push({ name: p.name, title: p.title || '', org: p.organization || '', role: 'panelist' });
        personsCount++;
      }

      if (speakers.length > 0) {
        results.push({
          event_id: String(event.id),
          year: 2025,
          speakers,
        });
      }
    });

    await Promise.all(promises);
    if (i % 100 === 0 && i > 0) await new Promise(r => setTimeout(r, 500));
  }

  await browser.close();

  console.log(`\nDone: ${results.length} events, ${contactCount} contacts, ${personsCount} persons`);
  fs.writeFileSync('tmp/all-2025-speakers.json', JSON.stringify(results, null, 2));
  console.log('Saved to tmp/all-2025-speakers.json');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

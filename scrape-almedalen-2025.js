const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROGRAM_URL = 'https://almedalsveckan.info/rg/almedalsveckan/officiellt-program/program-tidigare-ar/program-2025';
const API_URL = 'https://almedalsveckan.info/appresource/4.4e8c940c1946e1ba5811593f/12.4e8c940c1946e1ba581159d0/items';
const EVENT_BASE_URL = 'https://almedalsveckan.info/rg/almedalsveckan/evenemang-almedalsveckan/2025';
const PORTLET_ID = '12.4e8c940c1946e1ba581159d0';
const OUTPUT_PATH = path.join(__dirname, 'public', 'almedalen-2025.json');
const PAGE_SIZE = 30;
const DETAIL_CONCURRENCY = 10;

const DAY_NAMES = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];

const SWEDISH_STOP_WORDS = new Set([
  'och', 'i', 'att', 'en', 'ett', 'det', 'som', 'är', 'för', 'på', 'av',
  'med', 'den', 'till', 'har', 'de', 'inte', 'om', 'vi', 'kan', 'från',
  'var', 'alla', 'så', 'men', 'hur', 'vad', 'ska', 'sig', 'sin',
  'mot', 'vid', 'då', 'eller', 'nu', 'där', 'denna', 'detta', 'dessa',
  'vara', 'blir', 'bli', 'blev', 'skulle', 'under', 'efter', 'utan',
  'också', 'ha', 'hade', 'man', 'än', 'genom', 'när', 'över', 'mycket',
  'andra', 'sedan', 'bara', 'redan', 'hela', 'visa', 'upp', 'ut', 'ner',
  'del', 'mer', 'nog', 'får', 'gör', 'göra', 'ser', 'se', 'vår', 'våra',
  'din', 'ditt', 'dina', 'hans', 'hennes', 'sitt', 'sina', 'dem', 'dom',
]);

function generateTags(topic, secondaryTopic) {
  const parts = [];
  if (topic) parts.push(topic);
  if (secondaryTopic) parts.push(secondaryTopic);

  return [...new Set(
    parts.join(' ')
      .toLowerCase()
      .replace(/[^a-zåäö0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !SWEDISH_STOP_WORDS.has(w))
  )];
}

function transformEvent(raw, detail) {
  const date = raw.date || '';
  const startTime = (raw.startTime || '').replace('.', ':');
  const endTime = (raw.endTime || '').replace('.', ':');

  let day = '';
  if (raw.weekDayName) {
    day = raw.weekDayName.toLowerCase();
  } else if (date) {
    const dateObj = new Date(date + 'T12:00:00');
    day = DAY_NAMES[dateObj.getDay()] || '';
  }

  const id = raw.eventId || '';
  const organizer = Array.isArray(raw.organizer) ? raw.organizer.join(', ') : (raw.organizer || '');
  const tags = generateTags(raw.topic, raw.topic2);

  // Use detail page data for location and refreshments when available
  let location = 'Plats meddelas senare';
  if (detail?.location?.name) {
    location = detail.location.description
      ? `${detail.location.name}, ${detail.location.description}`
      : detail.location.name;
  } else if (raw.location?.name) {
    location = raw.location.description
      ? `${raw.location.name}, ${raw.location.description}`
      : raw.location.name;
  }

  const refreshments = detail?.refreshments === true;

  return {
    id,
    title: (raw.title || '').trim(),
    date,
    start_time: startTime,
    end_time: endTime,
    day,
    topic: raw.topic || '',
    secondary_topic: raw.topic2 || '',
    organizer,
    location,
    description: raw.socialIssue || '',
    extended_description: raw.description || '',
    event_type: raw.eventType || '',
    refreshments,
    language: raw.languages || '',
    url: id ? `${EVENT_BASE_URL}/${id}` : '',
    tags,
  };
}

async function fetchDetailBatch(browser, eventIds) {
  const results = {};
  const pages = await Promise.all(
    eventIds.map(() => browser.newPage())
  );

  await Promise.all(eventIds.map(async (eventId, i) => {
    const pg = pages[i];
    try {
      await pg.goto(`${EVENT_BASE_URL}/${eventId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      const data = await pg.evaluate(() => {
        // Find the event detail initial state
        const scripts = [...document.querySelectorAll('script')];
        for (const s of scripts) {
          const matches = [...s.textContent.matchAll(/registerInitialState\('([^']+)',\s*(\{[\s\S]*?\})\s*\)/g)];
          for (const m of matches) {
            try {
              const data = JSON.parse(m[2]);
              if (data.eventId) return data;
            } catch {}
          }
        }
        // Fallback: parse refreshments from DOM
        const text = document.body.innerText;
        const foodMatch = text.match(/Förtäring:\s*(Ja|Nej)/i);
        return { refreshments: foodMatch ? foodMatch[1].toLowerCase() === 'ja' : null };
      });

      results[eventId] = {
        location: data.location || null,
        refreshments: data.refreshments === true || (typeof data.refreshments === 'string' ? false : null),
      };

      // Extract refreshments from DOM if not in state
      if (results[eventId].refreshments === null) {
        const food = await pg.evaluate(() => {
          const text = document.body.innerText;
          const m = text.match(/Förtäring:\s*(Ja|Nej)/i);
          return m ? m[1].toLowerCase() === 'ja' : false;
        });
        results[eventId].refreshments = food;
      }
    } catch (err) {
      // Skip on error, will use fallback data
    } finally {
      await pg.close();
    }
  }));

  return results;
}

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log(`Navigating to ${PROGRAM_URL}...`);
  await page.goto(PROGRAM_URL, { waitUntil: 'networkidle', timeout: 120000 });

  // Get initial state (first 30 events + total count)
  const initialState = await page.evaluate((portletId) => {
    return AppRegistry.getInitialState(portletId);
  }, PORTLET_ID);

  const total = initialState.total || initialState.count;
  console.log(`Total events: ${total}`);

  const allItems = [...initialState.items];
  console.log(`Got ${allItems.length} from initial state.`);

  // Fetch remaining pages via API
  for (let start = PAGE_SIZE; start < total; start += PAGE_SIZE) {
    process.stdout.write(`\rFetching events ${start}-${Math.min(start + PAGE_SIZE, total)} of ${total}...`);

    let batch = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        batch = await page.evaluate(async ({ url, start }) => {
          const r = await fetch(`${url}?start=${start}&startDate=2025-06-23&endDate=2025-06-27&sortOption=relevance`);
          return r.json();
        }, { url: API_URL, start });
        break;
      } catch (err) {
        if (attempt < 2) {
          console.warn(`\nRetrying start=${start} (attempt ${attempt + 2})...`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          console.warn(`\nFailed to fetch start=${start} after 3 attempts, skipping.`);
        }
      }
    }

    if (batch?.items?.length > 0) {
      allItems.push(...batch.items);
    } else if (batch) {
      console.warn(`\nWarning: No items returned for start=${start}`);
      break;
    }

    // Small delay to avoid rate limiting
    if (start % 150 === 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  console.log(`\nFetched ${allItems.length} events from API.`);

  // Close the listing page
  await page.close();

  // Fetch detail data (location + refreshments) in parallel batches
  console.log(`Fetching detail data for ${allItems.length} events (${DETAIL_CONCURRENCY} parallel)...`);
  const detailMap = {};
  const eventIds = allItems.map(item => item.eventId).filter(Boolean);

  for (let i = 0; i < eventIds.length; i += DETAIL_CONCURRENCY) {
    const batch = eventIds.slice(i, i + DETAIL_CONCURRENCY);
    process.stdout.write(`\rDetail pages: ${i + batch.length}/${eventIds.length}`);
    const results = await fetchDetailBatch(browser, batch);
    Object.assign(detailMap, results);
  }
  console.log(`\nFetched ${Object.keys(detailMap).length} detail pages.`);

  await browser.close();

  // Transform events
  const events = allItems.map(raw => transformEvent(raw, detailMap[raw.eventId]));

  // Log warnings
  let warnings = 0;
  for (const e of events) {
    const missing = [];
    if (!e.id) missing.push('id');
    if (!e.title) missing.push('title');
    if (!e.date) missing.push('date');
    if (missing.length) {
      warnings++;
      if (warnings <= 10) {
        console.warn(`Warning: Event "${e.title?.slice(0, 50) || '(no title)'}" missing: ${missing.join(', ')}`);
      }
    }
  }
  if (warnings > 10) {
    console.warn(`... and ${warnings - 10} more events with warnings.`);
  }

  // Stats
  const withLocation = events.filter(e => e.location !== 'Plats meddelas senare').length;
  const withRefreshments = events.filter(e => e.refreshments).length;
  console.log(`Location filled: ${withLocation}/${events.length}`);
  console.log(`Refreshments (ja): ${withRefreshments}/${events.length}`);

  const output = {
    scraped_at: new Date().toISOString().slice(0, 10),
    total_events: events.length,
    events,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Saved ${events.length} events to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error('Scraping failed:', err);
  process.exit(1);
});

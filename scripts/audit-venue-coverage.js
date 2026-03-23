#!/usr/bin/env node
/**
 * Audit venue normalization coverage.
 * Fetches all events from Supabase (paginated), runs normalizeVenue on each,
 * and reports % matched by override vs regex fallback, top 50 unmatched names.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- COPY of ARENA_OVERRIDES from app/api/dashboard/route.ts ---
const ARENA_OVERRIDES = [
  // --- Folkhälsodalen (S:t Hansplan 2 + S:t Hansgatan 18) ---
  ['Folkhälsodalen', 'Folkhälsodalen'],
  ['S:t Hans Café', 'Folkhälsodalen'],
  ['S:t Hansplan 2', 'Folkhälsodalen'],
  ['S:t Hansgatan 18', 'Folkhälsodalen'],

  // --- Uppsala universitet / Campus Gotland (B/D/E-huset) ---
  ['Uppsala universitet', 'Uppsala universitet (Campus Gotland)'],
  ['Uppsala Universitet', 'Uppsala universitet (Campus Gotland)'],
  ['Science Park Gotland', 'Science Park Gotland'],

  // --- Dagens industri-komplexet (Strandvägen 4.x) ---
  ['Dagens industri', 'Dagens industris arena'],
  ['Strandvägen 4.1', 'Dagens industris arena'],
  ['Strandvägen 4.2', 'Dagens industris arena'],
  ['Strandvägen 4.3', 'Dagens industris arena'],
  ['Strandvägen 4.4', 'Dagens industris arena'],
  ['Strandvägen 4.6', 'Dagens industris arena'],
  ['Strands veranda', 'Dagens industris arena'],
  ['Strandvägen 4,', 'Dagens industris arena'],

  // --- Donnersgatan 6 = Hansaplatsen ---
  ['Hansaplatsen', 'Hansaplatsen'],
  ['Hansascenen', 'Hansaplatsen'],
  ['Donnersgatan 6', 'Hansaplatsen'],

  // --- Donnersgatan / Expressens scen ---
  ['Expressens scen', 'Expressens scen'],

  // --- Wisby Strand Congress & Event (Donnersgatan 2) ---
  ['Wisby Strand', 'Wisby Strand Congress & Event'],
  ['Techarena', 'Wisby Strand Congress & Event'],
  ['Donnersgatan 2', 'Wisby Strand Congress & Event'],

  // --- Donnerska huset (Donners plats 1) ---
  ['Donnerska huset', 'Donnerska huset'],
  ['Civilsamhällesarenan', 'Donnerska huset'],
  ['Donners plats 1', 'Donnerska huset'],

  // --- Clarion Hotel Wisby (Strandgatan 6) ---
  ['Clarion Hotel Wisby', 'Clarion Hotel Wisby'],
  ['Strandgatan 6', 'Clarion Hotel Wisby'],

  // --- Gotlands museum (Strandgatan 14 + Mellangatan 19) ---
  ['Gotlands museum', 'Gotlands museum'],
  ['SäkerhetsArenan', 'Gotlands museum'],
  ['Strandgatan 14', 'Gotlands museum'],
  ['Mellangatan 19', 'Gotlands museum'],

  // --- Almedalsbiblioteket (Cramérgatan 5) ---
  ['Almedalsbiblioteket', 'Almedalsbiblioteket'],
  ['Östersjödagarna', 'Almedalsbiblioteket'],
  ['Cramérgatan 5', 'Almedalsbiblioteket'],

  // --- Fartyg ---
  ['Teaterskeppet', 'Teaterskeppet'],
  ['Hållbarhetsarenan', 'Teaterskeppet'],
  ['Elida', 'Elida'],
  ['Belos', 'Belos'],

  // --- TCO-landet (Strandgatan 19) ---
  ['TCO-landet', 'TCO-landet'],
  ['Strandgatan 19', 'TCO-landet'],

  // --- Arena Energi (S:ta Katarinagatan 6) ---
  ['Arena Energi', 'Arena Energi'],
  ['S:ta Katarinagatan 6', 'Arena Energi'],

  // --- Kårhuset Rindi / Handelslandet (Donnersgatan 1) ---
  ['Kårhuset Rindi', 'Kårhuset Rindi'],
  ['Handelslandet', 'Kårhuset Rindi'],
  ['Donnersgatan 1', 'Kårhuset Rindi'],
  ['Donnergatan 1', 'Kårhuset Rindi'],

  // --- Supper / Business Arena (Strandgatan 9) ---
  ['Supper', 'Supper / Business Arena'],
  ['Business Arena', 'Supper / Business Arena'],
  ['Strandgatan 9', 'Supper / Business Arena'],

  // --- Vårdklockans kyrka (Adelsgatan 43) ---
  ['Vårdklockans kyrka', 'Vårdklockans kyrka'],
  ['Adelsgatan 43', 'Vårdklockans kyrka'],

  // --- Fastighetshubben (Adelsgatan 25) ---
  ['Fastighetshubben', 'Fastighetshubben'],
  ['Svefas innergård', 'Fastighetshubben'],
  ['Adelsgatan 25', 'Fastighetshubben'],

  // --- Ukrainska Hubben (Hamnplan plats 207) ---
  ['Ukrainska Hubben', 'Ukrainska Hubben'],

  // --- Björkanderska huset (Skeppsbron 24) ---
  ['Björkanderska', 'Björkanderska huset'],
  ['Joda Bar', 'Björkanderska huset'],
  ['Skeppsbron 24', 'Björkanderska huset'],

  // --- Katolska kyrkan (S:t Drottensgatan 12) ---
  ['Katolska kyrkan', 'Katolska kyrkan'],
  ['S:t Drottensgatan 12', 'Katolska kyrkan'],

  // --- Maritima Mötesplatsen (Hamngatan 1) ---
  ['Maritim Mötesplats', 'Maritima Mötesplatsen'],
  ['Hamngatan 1', 'Maritima Mötesplatsen'],

  // --- Svenskt Näringslivs trädgård (Hamngatan 3) ---
  ['Svenskt Näringsliv', 'Svenskt Näringslivs trädgård'],
  ['Hamngatan 3', 'Svenskt Näringslivs trädgård'],

  // --- Lunds universitet (Hästgatan 13) ---
  ['Hästgatan 13', 'Lunds universitet'],

  // --- PwC:s trädgård (Hästgatan 9) ---
  ['Hästgatan 9', 'PwC:s trädgård'],

  // --- Skandias trädgård (Strandgatan 27) ---
  ['Skandias trädgård', 'Skandias trädgård'],
  ['Strandgatan 27', 'Skandias trädgård'],

  // --- Värdshuset Lindgården (Strandgatan 26) ---
  ['Lindgården', 'Värdshuset Lindgården'],
  ['Strandgatan 26', 'Värdshuset Lindgården'],

  // --- Gotland Soldathem (Klinttorget 4) ---
  ['Gotland Soldathem', 'Gotland Soldathem'],
  ['Klinttorget 4', 'Gotland Soldathem'],

  // --- Mediescenen (Mellangatan 7) ---
  ['Mediescenen', 'Mediescenen'],
  ['Mellangatan 7', 'Mediescenen'],

  // --- Länsteatern (Bredgatan 10) ---
  ['Länsteatern', 'Länsteatern'],
  ['Bredgatan 10', 'Länsteatern'],

  // --- Bolaget (Stora Torget 16) ---
  ['Bolaget', 'Bolaget'],
  ['Stora Torget 16', 'Bolaget'],

  // --- Fenomenalen (Skeppsbron 6) ---
  ['Fenomenalen', 'Fenomenalen'],
  ['Skeppsbron 6', 'Fenomenalen'],

  // --- Best Western Strand Hotel (Strandgatan 34) ---
  ['Best Western Strand', 'Best Western Strand Hotel'],
  ['Strandgatan 34', 'Best Western Strand Hotel'],

  // --- S:t Hansskolan (S:t Hansgatan 32) ---
  ['S:t Hansskolan', 'S:t Hansskolan'],
  ['S:t Hansgatan 32', 'S:t Hansskolan'],

  // --- Altinget Arena (Strandgatan 16) ---
  ['Altinget Arena', 'Altinget Arena'],
  ['Strandgatan 16', 'Altinget Arena'],

  // --- Bulhuset (Hamnplan 5) ---
  ['Bulhuset', 'Bulhuset'],
  ['Hamnplan 5', 'Bulhuset'],

  // --- Samhällsbyggararenan (Hästgatan 4) ---
  ['Samhällsbyggararenan', 'Samhällsbyggararenan'],
  ['Hästgatan 4', 'Samhällsbyggararenan'],

  // --- 2030-arenan (Hästgatan 12) ---
  ['2030-arenan', '2030-arenan'],
  ['Hästgatan 12', '2030-arenan'],

  // --- Strandgatan 20 (Lif) ---
  ['Strandgatan 20', 'Lif-huset'],

  // --- Sverigearenan ---
  ['Sverigearenan', 'Sverigearenan'],

  // --- Vårdarenan ---
  ['Vårdarenan', 'Vårdarenan'],

  // --- Övriga namngivna ---
  ['S:ta Karins kyrkoruin', 'S:ta Karins kyrkoruin'],
  ['S:ta Maria domkyrka', 'S:ta Maria domkyrka'],
  ['Folkets Bio', 'Folkets Bio'],

  // --- Catch-all arena clusters (MUST be last — after all specific sub-rules) ---

  // Hamnplan tältarenor (371 events, tält H200-H246)
  // NOTE: comes after Bulhuset (Hamnplan 5) and Ukrainska Hubben rules
  ['Hamnplan, plats', 'Hamnplan (tältarenorna)'],
  ['Hamnplan, H', 'Hamnplan (tältarenorna)'],
  ['Hamnplan 6', 'Hamnplan (tältarenorna)'],

  // Strandvägen (övrigt utanför DI 4.x — Mötesplats Jönköping etc)
  ['Strandvägen, ', 'Strandvägen (övriga)'],
  ['Strandvägen,', 'Strandvägen (övriga)'],

  // Cramérgatan (utanför Uppsala universitet & Almedalsbiblioteket)
  ['Cramérgatan', 'Cramérgatan (övriga)'],

  // Hamngatan (utanför Maritima Mötesplatsen & Svenskt Näringsliv)
  ['Hamngatan, ', 'Hamngatan (övriga)'],
  ['Hamngatan,', 'Hamngatan (övriga)'],

  // Donnersgatan (utanför Hansaplatsen, Wisby Strand, Kårhuset Rindi)
  ['Donnersgatan', 'Donnersgatan (övriga)'],

  // Almedalen scen/mötestält/Partitorget
  ['Almedalen, scen', 'Almedalen (stora scenen)'],
  ['Almedalen, mötestält', 'Almedalen (mötestält)'],
  ['Partitorget', 'Partitorget'],

  // Named venues without existing overrides
  ['Fordonsexpo', 'Fordonsexpo'],
  ['SpelAlmedalen', 'SpelAlmedalen'],
  ['Strandgatan 1b', 'SpelAlmedalen'],
  ['Volters gränd 8', 'Swedbank och Sparbankernas hus'],
  ['Sparbankernas hus', 'Swedbank och Sparbankernas hus'],
  ['Mellangatan 27', 'Mellangatan 27'],
  ['Slottsterrassen', 'Slottsterrassen'],
  ['Fiskargränd 5', 'Fiskargränd 5'],
  ['Strandgatan 22', 'Strandgatan 22'],
  ['Klockgränd 4', 'Klockgränd 4'],
  ['Klosterbrunnsgatan 5', 'Klosterbrunnsgatan 5'],
  ['Södra kyrkogatan 3', 'Södra kyrkogatan 3'],
  ['S:t Hansgatan 21', 'S:t Hansgatan 21'],
  ['Novgorodgränd 1', 'Novgorodgränd 1'],
  ['Kronstallgränd 4', 'Kronstallgränd 4'],
  ['Korsgatan 4', 'Korsgatan 4'],
  ['Mellangatan 9', 'Mellangatan 9'],

  // --- Additional venues (to reach 85%+ coverage) ---

  // Tranhusgatan venues
  ['Tranhusgatan 6', 'Tranhusgatan 6 (S:t Clemens ruin)'],
  ['S:t Clemens ruin', 'Tranhusgatan 6 (S:t Clemens ruin)'],
  ['Tranhusgatan', 'Tranhusgatan (övriga)'],

  // Kilgränd
  ['Kilgränd 1', 'Kilgränd 1'],
  ['Kilgränd', 'Kilgränd (övriga)'],

  // Mellangatan (utanför Mediescenen 7 och Gotlands museum 19)
  ['Mellangatan 54', 'Mellangatan 54 (Bryggarsalen)'],
  ['Bryggarsalen', 'Mellangatan 54 (Bryggarsalen)'],
  ['Mellangatan 1', 'Mellangatan 1'],
  ['Mellangatan 21', 'Mellangatan 21'],
  ['Mellangatan 56', 'Mellangatan 56'],
  ['Mellangatan', 'Mellangatan (övriga)'],

  // Hästgatan (utanför Hästgatan 13, 9, 4, 12)
  ['Hästgatan 2', 'Hästgatan 2'],
  ['Hästgatan 1', 'Hästgatan 1'],
  ['Hästgatan', 'Hästgatan (övriga)'],

  // Donnersplats / Talarplats
  ['Talarplats, Donnersplats', 'Donnersplats (Talarplats)'],
  ['Donnersplats, Talarplats', 'Donnersplats (Talarplats)'],
  ['Talarplats, Donners plats', 'Donnersplats (Talarplats)'],
  ['Donnersplats', 'Donnersplats'],
  ['Donners plats 3', 'Donners plats 3'],

  // Ryska gränd
  ['Ryska gränd 18', 'Ryska gränd 18 (Grafikgruppen)'],
  ['Grafikgruppen', 'Ryska gränd 18 (Grafikgruppen)'],
  ['Ryska gränd', 'Ryska gränd (övriga)'],

  // Kapitelhusgården / S:t Drottensgatan 8
  ['S:t Drottensgatan 8', 'Kapitelhusgården'],
  ['Kapitelhusgården', 'Kapitelhusgården'],
  ['Körsbärsdalen', 'Kapitelhusgården'],

  // Södra Kyrkogatan
  ['Södra Kyrkogatan 15', 'Södra Kyrkogatan 15'],
  ['Södra kyrkogatan 15', 'Södra Kyrkogatan 15'],
  ['Södra Kyrkogatan 11', 'Södra Kyrkogatan 11'],
  ['Södra kyrkogatan 11', 'Södra Kyrkogatan 11'],
  ['Södra Kyrkogatan 7', 'Södra Kyrkogatan 7'],
  ['Södra kyrkogatan 7', 'Södra Kyrkogatan 7'],
  ['Södra Kyrkogatan', 'Södra Kyrkogatan (övriga)'],
  ['Södra kyrkogatan', 'Södra Kyrkogatan (övriga)'],

  // Klosterbrunnsgatan
  ['Klosterbrunnsgatan 3', 'Klosterbrunnsgatan 3'],

  // Södertorg
  ['Södertorg 12', 'Södertorg 12'],
  ['Södertorg', 'Södertorg (övriga)'],

  // Trappgränd / S:t Hansgatan
  ['Trappgränd 4', 'Trappgränd 4'],
  ['S:t Hansgatan 24', 'S:t Hansgatan 24'],
  ['S:t Hansgatan 22', 'S:t Hansgatan 22'],
  ['S:t Hansgatan 16', 'S:t Hansgatan 16'],
  ['S:t Hansgatan 9', 'S:t Hansgatan 9'],
  ['S:t Hansgatan', 'S:t Hansgatan (övriga)'],

  // Kinbergs plats
  ['Kinbergs plats 5', 'Kinbergs plats 5'],
  ['Kinbergs plats 3', 'Kinbergs plats 3'],
  ['Kinbergs plats', 'Kinbergs plats (övriga)'],

  // Blockgränd
  ['Blockgränd 6', 'Blockgränd 6'],
  ['Blockgränd', 'Blockgränd (övriga)'],

  // Almedalen (estradvagnen och övriga)
  ['Almedalen, Estradvagnen', 'Almedalen (Estradvagnen)'],
  ['Estradvagnen', 'Almedalen (Estradvagnen)'],
  ['Almedalen', 'Almedalen (övriga)'],

  // Norra Kyrkogatan / Församlingshuset
  ['Norra Kyrkogatan 2', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Norra kyrkogatan 2', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Församlingshuset Domkyrkan', 'Norra Kyrkogatan 2 (Församlingshuset)'],
  ['Norra Kyrkogatan', 'Norra Kyrkogatan (övriga)'],

  // Specksrum
  ['Specksrum 4', 'Specksrum 4'],
  ['Specksrum 5', 'Specksrum 5'],
  ['Specksrum', 'Specksrum (övriga)'],

  // Birgers Gränd
  ['Birgers Gränd 4', 'Birgers Gränd 4'],
  ['Birgers gränd 9', 'Birgers gränd 9'],
  ['Birgers Gränd', 'Birgers Gränd (övriga)'],
  ['Birgers gränd', 'Birgers Gränd (övriga)'],

  // Rostockergränd
  ['Rostockergränd 4', 'Rostockergränd 4'],
  ['Rostockergränd', 'Rostockergränd (övriga)'],

  // Berggränd
  ['Berggränd 6', 'Berggränd 6'],
  ['AI Swedens trädgård', 'Berggränd 6'],
  ['Berggränd', 'Berggränd (övriga)'],

  // Tage Cervins gata / Sveriges Radio
  ['Tage Cervins gata', 'Tage Cervins gata (Sveriges Radio)'],
  ['Sveriges Radio', 'Tage Cervins gata (Sveriges Radio)'],

  // Strandvägen 1 (Kallis) and Strandvägen 8
  ['Strandvägen 1', 'Strandvägen 1 (Kallis)'],
  ['Kallis', 'Strandvägen 1 (Kallis)'],
  ['Strandvägen 8', 'Strandvägen 8 (Almedalens Hotell)'],
  ['Almedalens Hotell', 'Strandvägen 8 (Almedalens Hotell)'],
  ['Strandvägen', 'Strandvägen (övriga)'],

  // Syskongatan / S:t Drotten kyrkoruin
  ['Syskongatan 1', 'Syskongatan 1 (S:t Drotten)'],
  ['S:t Drotten', 'Syskongatan 1 (S:t Drotten)'],

  // Wallers plats
  ['Wallers plats 3', 'Wallers plats 3'],
  ['Strykjärnshuset', 'Wallers plats 3'],
  ['Wallers plats', 'Wallers plats (övriga)'],

  // Biskopsgatan
  ['Biskopsgatan 1A', 'Biskopsgatan 1A'],
  ['Biskopsgatan', 'Biskopsgatan (övriga)'],

  // Skeppargatan
  ['Skeppargatan 24', 'Skeppargatan 24'],
  ['Skeppargatan', 'Skeppargatan (övriga)'],

  // Fartyg (utanför Teaterskeppet, Elida, Belos)
  ['Michael Sars', 'Fartyg (Michael Sars)'],
  ['fartyg', 'Fartyg (övriga)'],

  // Strandgatan 1 (övriga, utanför Strandgatan 1b SpelAlmedalen)
  ['Strandgatan 1', 'Strandgatan 1'],

  // Plats meddelas senare / Annan plats (okänd plats)
  ['Plats meddelas senare', 'Okänd plats'],
  ['Annan plats', 'Okänd plats'],
];

function normalizeVenue(locationName) {
  for (const [keyword, canonical] of ARENA_OVERRIDES) {
    if (locationName.includes(keyword)) return canonical;
  }
  // regex fallback (same as route.ts)
  return locationName
    .replace(/,\s*plats\s+\d+/gi, '')
    .replace(/,\s*(sal|lokal|rum)\s+\S+/gi, '')
    .replace(/,\s*[A-Z]\d{2,4}/g, '')
    .replace(/,\s*\d+$/g, '')
    .trim();
}

async function fetchAll(table, columns) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function main() {
  console.log('Fetching all events (paginated)...');
  const events = await fetchAll('events', 'id, location_name');
  console.log(`Total events: ${events.length}`);

  let overrideMatched = 0;
  let fallbackMatched = 0;
  const unmatchedCounts = new Map();
  const canonicalCounts = new Map();

  for (const event of events) {
    const loc = event.location_name || '';
    if (!loc) { fallbackMatched++; continue; }

    // Check if it matched an override
    let matched = false;
    for (const [keyword, canonical] of ARENA_OVERRIDES) {
      if (loc.includes(keyword)) {
        overrideMatched++;
        canonicalCounts.set(canonical, (canonicalCounts.get(canonical) || 0) + 1);
        matched = true;
        break;
      }
    }
    if (!matched) {
      fallbackMatched++;
      unmatchedCounts.set(loc, (unmatchedCounts.get(loc) || 0) + 1);
    }
  }

  const total = events.length;
  const pctOverride = ((overrideMatched / total) * 100).toFixed(1);
  const pctFallback = ((fallbackMatched / total) * 100).toFixed(1);

  console.log('\n=== COVERAGE REPORT ===');
  console.log(`Total events:           ${total}`);
  console.log(`Override-matched:       ${overrideMatched} (${pctOverride}%)`);
  console.log(`Fallback (unmatched):   ${fallbackMatched} (${pctFallback}%)`);

  // Top 50 unmatched raw location names
  const sortedUnmatched = [...unmatchedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50);

  console.log('\n=== TOP 50 UNMATCHED LOCATION NAMES ===');
  for (const [name, count] of sortedUnmatched) {
    console.log(`  ${count.toString().padStart(4)}  ${name}`);
  }

  // Total unique canonical arena names from overrides
  const uniqueArenas = canonicalCounts.size;
  console.log(`\nUnique canonical arenas matched: ${uniqueArenas}`);

  // Also show top matched arenas
  const sortedCanonical = [...canonicalCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  console.log('\n=== TOP 20 MATCHED ARENAS ===');
  for (const [name, count] of sortedCanonical) {
    console.log(`  ${count.toString().padStart(4)}  ${name}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

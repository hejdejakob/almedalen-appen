#!/usr/bin/env node
/**
 * Geocode top venue locations from events table using OpenStreetMap Nominatim.
 * Only geocodes the top ~100 venues by event count to stay within rate limits.
 * Groups location variants (strips room numbers) to reduce API calls.
 * Saves results to public/venue-coordinates.json and updates events.lat/lng in Supabase.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Strip room/hall numbers to get street-level address
function normalizeLocation(name) {
  if (!name) return null;
  let n = name.trim();
  // Remove common room/hall suffixes: H412, D24, B24, Sal B51, Lokal 3, etc.
  n = n.replace(/,?\s*(sal|lokal|rum|room)\s*[A-Za-z]?\d+/gi, '');
  n = n.replace(/,?\s*[A-Z]\d{2,4}[A-Z]?\b/g, ''); // H412, D24, B51, H534A
  n = n.replace(/,?\s*\d{2,4}\s*$/g, ''); // trailing numbers like ", 412"
  n = n.replace(/\s+/g, ' ').trim();
  n = n.replace(/,\s*$/, '').trim();
  return n || name.trim();
}

// Known Visby venue coordinates (hand-verified for key Almedalen locations)
const KNOWN_COORDS = {
  'Cramérgatan': { lat: 57.6394, lng: 18.2893 },
  'Hamnplan': { lat: 57.6389, lng: 18.2883 },
  'Hamngatan': { lat: 57.6389, lng: 18.2906 },
  'Skeppsbron': { lat: 57.6371, lng: 18.2868 },
  'Donnersgatan': { lat: 57.6395, lng: 18.2908 },
  'Mellangatan': { lat: 57.6391, lng: 18.2929 },
  'Donners plats': { lat: 57.6390, lng: 18.2912 },
  'Strandvägen': { lat: 57.6413, lng: 18.2898 },
  'Strandgatan': { lat: 57.6418, lng: 18.2922 },
  'S:t Hansgatan': { lat: 57.6384, lng: 18.2925 },
  'Adelsgatan': { lat: 57.6368, lng: 18.2940 },
  'Stora Torget': { lat: 57.6395, lng: 18.2950 },
  'Slottsterrassen': { lat: 57.6362, lng: 18.2872 },
  'Södertorg': { lat: 57.6360, lng: 18.2946 },
  'Tranhusgatan': { lat: 57.6444, lng: 18.2965 },
  'Klinttorget': { lat: 57.6367, lng: 18.2910 },
  'Klosterbrunnsgatan': { lat: 57.6400, lng: 18.2953 },
  'S:ta Katarinagatan': { lat: 57.6405, lng: 18.2951 },
  'Fiskargränd': { lat: 57.6428, lng: 18.2928 },
  'Volters gränd': { lat: 57.6388, lng: 18.2917 },
  'Västra Kyrkogatan': { lat: 57.6390, lng: 18.2948 },
  'Syskongatan': { lat: 57.6410, lng: 18.2948 },
  'Bredgatan': { lat: 57.6378, lng: 18.2924 },
  'Norra Kyrkogatan': { lat: 57.6405, lng: 18.2938 },
  'Korsgatan': { lat: 57.6373, lng: 18.2926 },
  // Named venues
  'Donners plats 1, Donnerska huset': { lat: 57.6390, lng: 18.2914 },
  'D-huset, Uppsala universitet, Kaserngatan 1': { lat: 57.6392, lng: 18.2882 },
  'B-huset, Uppsala universitet, Huvudentré Cramérgatan 3': { lat: 57.6396, lng: 18.2889 },
  'E-huset, Uppsala universitet, Huvudentré Cramérgatan 3': { lat: 57.6397, lng: 18.2886 },
  'Cramérgatan 5, Almedalsbiblioteket': { lat: 57.6396, lng: 18.2895 },
  'S:t Hansgatan 32, S:t Hansskolan': { lat: 57.6370, lng: 18.2925 },
  'Donnergatan 1, Kårhuset Rindi': { lat: 57.6393, lng: 18.2905 },
  'Donnergatan 2, Wisby Strand Congress & Event': { lat: 57.6392, lng: 18.2900 },
  'Strandgatan 14, Gotlands museum': { lat: 57.6415, lng: 18.2920 },
  'Strandvägen 4, Strands veranda': { lat: 57.6408, lng: 18.2895 },
  'Strandvägen 8, Almedalens Hotell': { lat: 57.6410, lng: 18.2890 },
  'Bredgatan 10, Länsteatern': { lat: 57.6380, lng: 18.2920 },
  'Tranhusgatan 6, S:t Clemens ruin': { lat: 57.6442, lng: 18.2960 },
  'Västra Kyrkogatan 2, S:ta Maria domkyrka': { lat: 57.6390, lng: 18.2950 },
  'S:t Hansplan 2, S:t Hans Café': { lat: 57.6384, lng: 18.2930 },
  'Skeppsbron 24, Joda Bar och kök': { lat: 57.6375, lng: 18.2870 },
  'Adelsgatan 43, Vårdklockans kyrka': { lat: 57.6375, lng: 18.2945 },
  'Mellangatan 54, Bryggarsalen': { lat: 57.6395, lng: 18.2935 },
  'S:t Hansgatan 11, Gamla riksbanken': { lat: 57.6382, lng: 18.2928 },
  'Södertorg 12, innergården': { lat: 57.6358, lng: 18.2948 },
  'Stora Torget 16, Bolaget': { lat: 57.6397, lng: 18.2952 },
  // Generic venue types
  'Almedalen, mötestält': { lat: 57.6385, lng: 18.2888 },
  'Almedalen, scen': { lat: 57.6387, lng: 18.2890 },
  'Almedalen, Partitorget': { lat: 57.6386, lng: 18.2885 },
  'Talarplats, Donners plats': { lat: 57.6390, lng: 18.2910 },
  'Fordonsexpo': { lat: 57.6388, lng: 18.2880 },
  'Annan plats': { lat: 57.6390, lng: 18.2900 },
  // Vessels
  'fartyg, Teaterskeppet': { lat: 57.6375, lng: 18.2862 },
  'fartyg, KBV 002 Triton': { lat: 57.6373, lng: 18.2858 },
  'fartyg, Belos': { lat: 57.6370, lng: 18.2855 },
};

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=se`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AlmedalsData/1.0 (jakob@reformsociety.se)' }
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.startsWith('[') && !text.startsWith('{')) return null;
    const data = JSON.parse(text);
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    // Rate limited or network error — skip
  }
  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  // 1. Fetch all location_name values with counts
  const rows = [];
  let from = 0;
  while (true) {
    const { data } = await supabase
      .from('events')
      .select('location_name')
      .not('location_name', 'is', null)
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // Count per location
  const locationCounts = {};
  for (const r of rows) {
    if (r.location_name) {
      locationCounts[r.location_name] = (locationCounts[r.location_name] || 0) + 1;
    }
  }

  const allLocations = Object.keys(locationCounts);
  console.log(`Found ${allLocations.length} unique location names`);

  // 2. Group by normalized address
  const groups = {};
  for (const loc of allLocations) {
    const norm = normalizeLocation(loc);
    if (!groups[norm]) groups[norm] = { locations: [], totalEvents: 0 };
    groups[norm].locations.push(loc);
    groups[norm].totalEvents += locationCounts[loc];
  }

  // Sort by total events and take top 150
  const sortedGroups = Object.entries(groups)
    .sort(([, a], [, b]) => b.totalEvents - a.totalEvents);

  const topGroups = sortedGroups.slice(0, 150);
  console.log(`Top 150 groups cover ${topGroups.reduce((s, [, g]) => s + g.totalEvents, 0)} events out of ${rows.length}`);

  // 3. Load existing results if any
  const outputPath = 'public/venue-coordinates.json';
  let existing = {};
  if (fs.existsSync(outputPath)) {
    existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    console.log(`Loaded ${Object.keys(existing).length} existing geocoded entries`);
  }

  // 4. Geocode each address
  let geocoded = 0;
  let fromKnown = 0;
  let failed = 0;
  const results = { ...existing };

  for (const [addr, group] of topGroups) {
    if (results[addr]) continue;

    // Check known coordinates first
    let coords = null;
    if (KNOWN_COORDS[addr]) {
      coords = KNOWN_COORDS[addr];
      fromKnown++;
    }

    // Try Nominatim if not in known list
    if (!coords) {
      coords = await geocode(`${addr}, Visby, Gotland, Sweden`);
      if (!coords) {
        coords = await geocode(`${addr}, Gotland, Sweden`);
      }
      // Rate limit
      await sleep(1200);

      // Sanity check
      if (coords && (coords.lat < 57.5 || coords.lat > 57.8 || coords.lng < 18.1 || coords.lng > 18.5)) {
        console.log(`  ✗ ${addr} → outside Visby (${coords.lat}, ${coords.lng}), skipping`);
        coords = null;
      }
    }

    if (coords) {
      results[addr] = {
        lat: coords.lat,
        lng: coords.lng,
        locations: group.locations,
      };
      geocoded++;
      console.log(`  ✓ ${addr} → ${coords.lat}, ${coords.lng} (${group.locations.length} variants, ${group.totalEvents} events)`);
    } else {
      // Try to match by street name prefix from known coords
      const streetMatch = Object.keys(KNOWN_COORDS).find(k => addr.startsWith(k));
      if (streetMatch) {
        const c = KNOWN_COORDS[streetMatch];
        // Add small offset to avoid perfect overlap
        results[addr] = {
          lat: c.lat + (Math.random() - 0.5) * 0.0005,
          lng: c.lng + (Math.random() - 0.5) * 0.0005,
          locations: group.locations,
        };
        geocoded++;
        fromKnown++;
        console.log(`  ~ ${addr} → matched to ${streetMatch} (${group.locations.length} variants, ${group.totalEvents} events)`);
      } else {
        console.log(`  ✗ ${addr} → not found (${group.totalEvents} events)`);
        failed++;
      }
    }

    // Save periodically
    if (geocoded % 20 === 0) {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    }
  }

  console.log(`\nGeocoded: ${geocoded} (${fromKnown} from known coords), Failed: ${failed}, Total: ${Object.keys(results).length}`);

  // 5. Save final results
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved to ${outputPath}`);

  // 6. Update events table with lat/lng
  const locationCoords = {};
  for (const [, data] of Object.entries(results)) {
    for (const origName of data.locations) {
      locationCoords[origName] = { lat: data.lat, lng: data.lng };
    }
  }

  console.log(`\nUpdating ${Object.keys(locationCoords).length} location variants in Supabase...`);
  let updated = 0;
  for (const [locName, coords] of Object.entries(locationCoords)) {
    const { error } = await supabase
      .from('events')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('location_name', locName)
      .is('lat', null);

    if (error) {
      console.error(`  Error updating "${locName}":`, error.message);
    } else {
      updated++;
    }
  }
  console.log(`Updated ${updated} location variants in Supabase`);
}

main().catch(console.error);

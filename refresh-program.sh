#!/bin/bash
# Dagligt program-refresh för almedalsdata.se.
# Scrapar Almedalsveckans 2026-program (playwright) och upsertar till Supabase
# DUBBLETTSÄKERT (events: onConflict year,source_id). Körs av launchd-jobbet
# se.almedalsdata.refresh dagligen.
#
# SÄKERHET: en sanity-grind avbryter HELA körningen (utan att röra DB) om
# scrapen ger för få events — annars skulle en trasig scrape kunna radera/
# nollställa 2026-data. Historiska år (2022–2025) bevaras alltid eftersom
# build-almedalen-all.js mergar in färska 2026 i den kompletta almedalen-all.json.

set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/jakobohlsson/almedalen-appen || exit 1
mkdir -p logs
exec >> logs/refresh-program.log 2>&1

echo ""
echo "===== $(date '+%Y-%m-%d %H:%M:%S') REFRESH START ====="

# 0. Spara förra goda 2026-filen (återställs vid sanity-fail)
cp -f public/almedalen-2026.json public/almedalen-2026.json.prev 2>/dev/null || true

# 1. Scrape → public/almedalen-2026.json (icke-destruktivt mot DB)
if ! node scrape-almedalen.js; then
  echo "!! SCRAPE MISSLYCKADES — DB orörd, behåller förra datan"
  exit 1
fi

# 2. Sanity-grind: kräver minst 2000 events i den färska filen
N=$(node -e "try{process.stdout.write(String(JSON.parse(require('fs').readFileSync('public/almedalen-2026.json')).events.length))}catch(e){process.stdout.write('0')}")
echo "Scrapade events: $N"
if [ "${N:-0}" -lt 2000 ]; then
  echo "!! SANITY FAIL ($N < 2000) — återställer förra filen, DB ORÖRD"
  cp -f public/almedalen-2026.json.prev public/almedalen-2026.json 2>/dev/null || true
  exit 1
fi

# 3. Merge in färska 2026 i komplett all.json (bevarar 2022–2025), upsert allt
node build-almedalen-all.js  || { echo "!! build-almedalen-all MISSLYCKADES"; exit 1; }
node ingest.js               || { echo "!! ingest MISSLYCKADES"; exit 1; }
node load-participants-v2.js || { echo "!! load-participants MISSLYCKADES"; exit 1; }
node build-aggregates.js     || echo "!! build-aggregates misslyckades (aggregat ej uppdaterade; events/deltagare OK)"

echo "===== $(date '+%Y-%m-%d %H:%M:%S') REFRESH KLAR ====="

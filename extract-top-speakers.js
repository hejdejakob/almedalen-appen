// Extract top 1000 speakers by total panel count with context for classification
// Output: tmp/top-1000-speakers.json
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VISIBLE_YEARS = [2022, 2023, 2024, 2025];

async function fetchAll(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  console.log('Fetching speaker_stats...');
  const stats = await fetchAll('speaker_stats', 'speaker_id, year, panel_count');

  // Aggregate across visible years
  const totals = {};
  for (const s of stats) {
    if (!VISIBLE_YEARS.includes(s.year)) continue;
    if (!totals[s.speaker_id]) totals[s.speaker_id] = 0;
    totals[s.speaker_id] += s.panel_count;
  }

  // Sort and take top 1000
  const topIds = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1000)
    .map(([id, panels]) => ({ id: parseInt(id), totalPanels: panels }));

  console.log(`Top 1000 speakers selected (min panels: ${topIds[topIds.length - 1].totalPanels})`);

  // Fetch speaker details
  console.log('Fetching speaker details...');
  const speakers = await fetchAll('speakers', 'id, name, title, org_name');
  const speakerMap = new Map(speakers.map(s => [s.id, s]));

  const result = topIds.map(({ id, totalPanels }) => {
    const sp = speakerMap.get(id);
    return {
      id,
      name: sp?.name || 'Unknown',
      title: sp?.title || null,
      org_name: sp?.org_name || null,
      totalPanels,
    };
  });

  // Write output
  const outDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'top-1000-speakers.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

  console.log(`\nWrote ${result.length} speakers to ${outPath}`);
  console.log(`With title: ${result.filter(r => r.title).length}`);
  console.log(`With org: ${result.filter(r => r.org_name).length}`);
  console.log(`With both: ${result.filter(r => r.title && r.org_name).length}`);
  console.log(`With neither: ${result.filter(r => !r.title && !r.org_name).length}`);
}

main().catch(console.error);

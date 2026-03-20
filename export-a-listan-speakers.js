// Export unique speakers from A-listan (top 50 per category) for title/org updates
// Output: tmp/a-listan-speakers.json
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
  // 1. Fetch all speaker_stats
  console.log('Fetching speaker_stats...');
  const stats = await fetchAll('speaker_stats', 'speaker_id, year, panel_count');

  // Aggregate across visible years
  const totals = {};
  for (const s of stats) {
    if (!VISIBLE_YEARS.includes(s.year)) continue;
    if (!totals[s.speaker_id]) totals[s.speaker_id] = 0;
    totals[s.speaker_id] += s.panel_count;
  }

  // 2. Fetch all classifications
  console.log('Fetching speaker_classifications...');
  const classifications = await fetchAll('speaker_classifications', 'speaker_id, category');
  const catMap = {};
  for (const c of classifications) {
    catMap[c.speaker_id] = c.category;
  }

  // 3. Group by category and take top 50 per category
  const byCategory = {};
  for (const [id, panels] of Object.entries(totals)) {
    const cat = catMap[id] || 'okategoriserad';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push({ id: parseInt(id), totalPanels: panels });
  }

  const selectedIds = new Set();
  for (const [cat, speakers] of Object.entries(byCategory)) {
    speakers.sort((a, b) => b.totalPanels - a.totalPanels);
    const top = speakers.slice(0, 50);
    console.log(`${cat}: ${top.length} speakers (min panels: ${top[top.length - 1]?.totalPanels})`);
    for (const s of top) selectedIds.add(s.id);
  }

  console.log(`\nTotal unique speakers: ${selectedIds.size}`);

  // 4. Fetch speaker details
  console.log('Fetching speaker details...');
  const idArray = Array.from(selectedIds);
  const speakers = [];
  for (let i = 0; i < idArray.length; i += 100) {
    const batch = idArray.slice(i, i + 100);
    const { data } = await supabase
      .from('speakers')
      .select('id, name, title, org_name')
      .in('id', batch);
    if (data) speakers.push(...data);
  }

  // 5. Build output
  const result = speakers.map(s => ({
    id: s.id,
    name: s.name,
    current_title: s.title || null,
    current_org: s.org_name || null,
    category: catMap[s.id] || 'okategoriserad',
    total_panels: totals[s.id] || 0,
    new_title: null,
    new_org: null
  })).sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.total_panels - a.total_panels;
  });

  // 6. Stats
  const noOrg = result.filter(r => !r.current_org).length;
  const noTitle = result.filter(r => !r.current_title).length;
  console.log(`Missing org: ${noOrg}, Missing title: ${noTitle}`);

  // 7. Write output
  const outPath = path.join(__dirname, 'tmp', 'a-listan-speakers.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nWrote ${result.length} speakers to ${outPath}`);
}

main().catch(console.error);

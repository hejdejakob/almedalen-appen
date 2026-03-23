// Spot-check verification script for total_event_links column.
// Checks Uppsala universitet 2024 and TCO 2024.
// Run after: node build-aggregates.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Find Uppsala universitet arranger_id
  const { data: uuArr } = await supabase
    .from('arrangers')
    .select('id, name')
    .ilike('name', '%Uppsala universitet%')
    .limit(5);

  console.log('Uppsala-matching arrangers:', uuArr?.map(a => `${a.id}: ${a.name}`));

  if (uuArr && uuArr.length > 0) {
    const uuId = uuArr[0].id;
    const { data: uuStats } = await supabase
      .from('arranger_stats')
      .select('arranger_id, year, events_count, total_event_links')
      .eq('arranger_id', uuId)
      .eq('year', 2024)
      .single();
    console.log('\nUppsala universitet 2024:', uuStats);
    if (uuStats) {
      console.log(`  events_count (weighted): ${uuStats.events_count}`);
      console.log(`  total_event_links (raw):  ${uuStats.total_event_links}`);
      console.log(`  Expected total_event_links ~78`);
    }
  }

  // TCO (arranger_id 10870 per task spec, but also search by name)
  const { data: tcoArr } = await supabase
    .from('arrangers')
    .select('id, name')
    .ilike('name', 'TCO%')
    .limit(5);

  console.log('\nTCO-matching arrangers:', tcoArr?.map(a => `${a.id}: ${a.name}`));

  const tcoId = tcoArr && tcoArr.length > 0 ? tcoArr[0].id : 10870;
  const { data: tcoStats } = await supabase
    .from('arranger_stats')
    .select('arranger_id, year, events_count, total_event_links')
    .eq('arranger_id', tcoId)
    .eq('year', 2024)
    .single();
  console.log('\nTCO 2024:', tcoStats);
  if (tcoStats) {
    console.log(`  events_count (weighted): ${tcoStats.events_count}`);
    console.log(`  total_event_links (raw):  ${tcoStats.total_event_links}`);
    console.log(`  Expected total_event_links ~6`);
  }
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

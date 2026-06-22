// READ-ONLY: vad innehåller events-tabellen, och har 2026 dag/tid/plats?
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: sample, error } = await db.from('events').select('*').limit(1);
if (error) { console.error(error.message); process.exit(1); }
const cols = Object.keys(sample[0] || {});
console.log('=== EVENTS-KOLUMNER ===');
console.log(cols.join(', '));
console.log('\n=== EXEMPELRAD ===');
console.log(JSON.stringify(sample[0], null, 1));

console.log('\n=== EVENTS PER ÅR ===');
for (const y of [2022, 2023, 2024, 2025, 2026]) {
  const { count } = await db.from('events').select('*', { count: 'exact', head: true }).eq('year', y);
  console.log(`  ${y}: ${count}`);
}

console.log('\n=== 2026: IFYLLNADSGRAD PER KOLUMN ===');
const { data: e26 } = await db.from('events').select('*').eq('year', 2026).limit(3000);
console.log(`(${e26.length} 2026-events)`);
for (const c of cols) {
  const filled = e26.filter(r => r[c] !== null && r[c] !== '' && r[c] !== undefined).length;
  const ex = e26.find(r => r[c] !== null && r[c] !== '' && r[c] !== undefined)?.[c];
  console.log(`  ${c.padEnd(22)} ${String(filled).padStart(4)}/${e26.length}  ex: ${JSON.stringify(ex)?.slice(0, 50)}`);
}

// finns separata program/schema/venue-tabeller?
console.log('\n=== TESTAR ANDRA TABELLER ===');
for (const t of ['program', 'schedule', 'sessions', 'venues', 'locations', 'event_times']) {
  const { error: e } = await db.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t}: ${e ? 'finns ej (' + e.message.slice(0, 40) + ')' : 'FINNS'}`);
}

// READ-ONLY: arrangörskoncentration per person → skilj "en person" från möjlig hopslagning.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fetchAll(t, sel, col, vals, oc) {
  let out = [];
  for (const c of chunk(vals, 40)) { let f = 0; const s = 1000; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data, error } = await q.range(f, f + s - 1); if (error) { console.error(t, error.message); break; } out.push(...data); if (data.length < s) break; f += s; } }
  return out;
}

const seed = JSON.parse(readFileSync('/Users/jakobohlsson/resume-almedalen-2026/source/enrichment_seed.json', 'utf8'));
const commonByName = new Map(seed.map(s => [s.namn, s.vanligt_namn]));
const norms = [...new Set(seed.map(s => s.namn.toLowerCase().trim()))];

const sp = await fetchAll('speakers', 'id,name,name_normalized', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const nameByNorm = new Map(seed.map(s => [s.namn.toLowerCase().trim(), s.namn]));
const allIds = sp.map(s => s.id);

const es = await fetchAll('event_speakers', 'event_id,speaker_id', 'speaker_id', allIds, ['event_id', 'speaker_id']);
const evIds = [...new Set(es.map(r => r.event_id))];
const ea = await fetchAll('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const primaryArr = new Map();
for (const r of ea) { if (r.is_primary || !primaryArr.has(r.event_id)) primaryArr.set(r.event_id, r.arranger_id); }

// per norm: seminarier + arrangörhistogram
const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }

const rows = [];
for (const nm of evByNorm.keys()) {
  const evs = [...evByNorm.get(nm)];
  const hist = {};
  for (const e of evs) { const a = primaryArr.get(e) ?? 'okänd'; hist[a] = (hist[a] || 0) + 1; }
  const counts = Object.values(hist).sort((a, b) => b - a);
  const sem = evs.length;
  const top = counts[0] || 0;
  const topShare = sem ? top / sem : 0;
  const distinctArr = counts.length;
  const name = nameByNorm.get(nm) || nm;
  rows.push({ name, sem, topShare, distinctArr, common: commonByName.get(name) || false });
}

const CONC = 0.5; // ≥50% från en arrangör = koncentrerad = en person
const concentrated = rows.filter(r => r.topShare >= CONC);
const dispCommon = rows.filter(r => r.topShare < CONC && r.common);
const dispUncommon = rows.filter(r => r.topShare < CONC && !r.common);

console.log(`Totalt: ${rows.length}`);
console.log(`Koncentrerade (≥50% en arrangör → trolig EN person): ${concentrated.length}`);
console.log(`Spridda + OVANLIGT namn (trolig flitig frilans, EN person): ${dispUncommon.length}`);
console.log(`Spridda + VANLIGT namn (= verklig hopslagningsmisstanke): ${dispCommon.length}\n`);
console.log(`>>> ATT GRANSKA — spridda OCH vanligt namn (sorterat på sem):`);
dispCommon.sort((a, b) => b.sem - a.sem).forEach(r => console.log(`   ${r.name.padEnd(24)} ${String(r.sem).padStart(3)} sem · topShare ${(r.topShare * 100).toFixed(0).padStart(3)}% · ${r.distinctArr} arrangörer`));
console.log(`\n(referens) spridda men ovanligt namn — troliga frilansare, ej hopslagning:`);
dispUncommon.sort((a, b) => b.sem - a.sem).slice(0, 10).forEach(r => console.log(`   ${r.name.padEnd(24)} ${String(r.sem).padStart(3)} sem · topShare ${(r.topShare * 100).toFixed(0).padStart(3)}% · ${r.distinctArr} arrangörer`));

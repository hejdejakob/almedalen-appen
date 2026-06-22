// READ-ONLY: korrekt paginerad räknekoll (fixar 1000-radstrunkeringen).
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// Korrekt: paginera VARJE .in()-chunk med .range() tills uttömd, deterministisk order.
async function fetchAll(t, sel, col, vals, orderCols) {
  let out = [];
  for (const c of chunk(vals, 40)) {
    let from = 0; const size = 1000;
    for (;;) {
      let q = db.from(t).select(sel).in(col, c);
      for (const oc of orderCols) q = q.order(oc, { ascending: true });
      const { data, error } = await q.range(from, from + size - 1);
      if (error) { console.error(t, error.message); break; }
      out.push(...data);
      if (data.length < size) break;
      from += size;
    }
  }
  return out;
}

const src = readFileSync('/Users/jakobohlsson/resume-almedalen-2026/data.js', 'utf8');
const window = {}; eval(src);
const listed = window.DATA.totalt.map(r => ({ namn: r.namn, sem: r.sem }));
const norms = [...new Set(listed.map(r => r.namn.toLowerCase().trim()))];

const sp = await fetchAll('speakers', 'id,name,name_normalized', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const allIds = sp.map(s => s.id);

const es = await fetchAll('event_speakers', 'event_id,speaker_id', 'speaker_id', allIds, ['event_id', 'speaker_id']);
const stats = await fetchAll('speaker_stats', 'speaker_id,panel_count', 'speaker_id', allIds, ['speaker_id']);

const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }
const statByNorm = new Map();
for (const r of stats) { const nm = normById.get(r.speaker_id); if (!nm) continue; statByNorm.set(nm, (statByNorm.get(nm) || 0) + (r.panel_count || 0)); }

console.log(`event_speakers-rader hämtade: ${es.length} (mot ${allIds.length} talare)\n`);

let okTrue = 0, okStat = 0; const diffs = [];
for (const r of listed) {
  const nm = r.namn.toLowerCase().trim();
  const trueN = (evByNorm.get(nm) || new Set()).size;
  const statN = statByNorm.get(nm) || 0;
  if (trueN === r.sem) okTrue++;
  if (statN === r.sem) okStat++;
  diffs.push({ n: r.namn, listed: r.sem, trueN, statN, d: r.sem - trueN });
}
console.log(`listad === stats-summa: ${okStat}/${listed.length}  (bekräftar att listan byggdes på speaker_stats)`);
console.log(`listad === SANN distinkt seminarieräkning: ${okTrue}/${listed.length}`);
const real = diffs.filter(x => x.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log(`\nKvarvarande avvikelser efter fix: ${real.length}`);
real.slice(0, 20).forEach(x => console.log(`   ${x.n.padEnd(22)} listad ${String(x.listed).padStart(3)} · sann ${String(x.trueN).padStart(3)} · stats ${String(x.statN).padStart(3)}  (${x.d > 0 ? '+' : ''}${x.d})`));

// fördelning av avvikelsens storlek
const buckets = { '0': 0, '1-2': 0, '3-5': 0, '6+': 0 };
for (const x of diffs) { const a = Math.abs(x.d); if (a === 0) buckets['0']++; else if (a <= 2) buckets['1-2']++; else if (a <= 5) buckets['3-5']++; else buckets['6+']++; }
console.log(`\nAvvikelse listad vs sann: exakt rätt ${buckets['0']} · ±1-2 ${buckets['1-2']} · ±3-5 ${buckets['3-5']} · ±6+ ${buckets['6+']}`);

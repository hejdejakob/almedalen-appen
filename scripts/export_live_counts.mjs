// READ-ONLY: exportera live distinkt seminarieräkning + enrichment-seed för vår lista.
// Skriver till resume-almedalen-2026/source/enrichment_seed.json
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
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

const COMMON_SUR = new Set(['andersson', 'johansson', 'karlsson', 'nilsson', 'eriksson', 'larsson', 'olsson', 'persson', 'svensson', 'gustafsson', 'pettersson', 'jonsson', 'jansson', 'hansson', 'bengtsson', 'lindberg', 'lindström', 'lindgren', 'axelsson', 'berg', 'lund', 'nyberg', 'holm', 'nyström', 'lindqvist', 'magnusson', 'olofsson', 'jakobsson', 'wallin', 'henriksson']);
const COMMON_FIRST = new Set(['anna', 'maria', 'johan', 'anders', 'per', 'lars', 'karin', 'erik', 'eva', 'sara', 'emma', 'mikael', 'fredrik', 'jonas', 'andreas', 'thomas', 'daniel', 'david', 'martin', 'henrik', 'peter', 'jan', 'sofia', 'linda', 'helena', 'malin', 'sandra', 'jenny', 'emelie', 'hanna']);

const src = readFileSync('/Users/jakobohlsson/resume-almedalen-2026/data.js', 'utf8');
const window = {}; eval(src);
const listed = window.DATA.totalt.map(r => ({ namn: r.namn, sem: r.sem, kategori: r.kategori }));
const norms = [...new Set(listed.map(r => r.namn.toLowerCase().trim()))];

const sp = await fetchAll('speakers', 'id,name,name_normalized,title,org_name', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const metaByNorm = new Map();
for (const s of sp) if (!metaByNorm.has(s.name_normalized)) metaByNorm.set(s.name_normalized, { title: s.title || '', org: s.org_name || '' });
const allIds = sp.map(s => s.id);

const es = await fetchAll('event_speakers', 'event_id,speaker_id', 'speaker_id', allIds, ['event_id', 'speaker_id']);
const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }

const seed = listed.map(r => {
  const nm = r.namn.toLowerCase().trim();
  const live = (evByNorm.get(nm) || new Set()).size;
  const meta = metaByNorm.get(nm) || { title: '', org: '' };
  const toks = nm.split(/\s+/);
  const common = COMMON_SUR.has(toks[toks.length - 1]) || COMMON_FIRST.has(toks[0]);
  return {
    namn: r.namn, kategori: r.kategori,
    live_count: live, gammalt_count: r.sem,
    frusen_titel: meta.title, frusen_org: meta.org,
    vanligt_namn: common,
    kollisionsrisk: common && live >= 8,
  };
});

writeFileSync('/Users/jakobohlsson/resume-almedalen-2026/source/enrichment_seed.json', JSON.stringify(seed, null, 1));
const changed = seed.filter(s => s.live_count !== s.gammalt_count).length;
console.log(`Skrev enrichment_seed.json — ${seed.length} personer`);
console.log(`Live-räkning skiljer från gammalt: ${changed}`);
console.log(`Vanliga namn (extra kollisionsgranskning): ${seed.filter(s => s.vanligt_namn).length}  varav hög kollisionsrisk (vanligt + ≥8 sem): ${seed.filter(s => s.kollisionsrisk).length}`);
console.log(`\nHög kollisionsrisk att granska:`);
seed.filter(s => s.kollisionsrisk).sort((a, b) => b.live_count - a.live_count).forEach(s => console.log(`   ${s.namn.padEnd(22)} ${String(s.live_count).padStart(3)} sem · ${s.kategori}`));

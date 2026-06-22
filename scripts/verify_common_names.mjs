// READ-ONLY: verifiera seminarieantal för (vanliga) namn i Resumé-listan via
// arrangörskoncentration. Spritt + vanligt namn = misstänkt hopslagning.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fa(t, sel, col, vals, oc) { let out = []; for (const c of chunk(vals, 60)) { let f = 0; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data } = await q.range(f, f + 999); out.push(...data); if (data.length < 1000) break; f += 1000; } } return out; }

const COMMON_SUR = new Set(['andersson','johansson','karlsson','nilsson','eriksson','larsson','olsson','persson','svensson','gustafsson','pettersson','jonsson','jansson','hansson','bengtsson','lindberg','lindström','lindgren','axelsson','berg','lund','nyberg','holm','nyström','lindqvist','magnusson','olofsson','jakobsson','wallin','henriksson','ohlsson','sandberg','forsberg','sjöberg','wikström','engström','danielsson','håkansson','löfgren','bergström','mattsson','johnsson','hermansson','fredriksson','arvidsson','blom','nordström','holmberg','lundberg']);
const COMMON_FIRST = new Set(['anna','maria','johan','anders','per','lars','karin','erik','eva','sara','emma','mikael','fredrik','jonas','andreas','thomas','daniel','david','martin','henrik','peter','jan','sofia','linda','helena','malin','sandra','jenny','emelie','hanna','kristina','marie','ulrika','christer','mats','niklas','magnus','jakob','stefan','mattias']);

const src = readFileSync('/Users/jakobohlsson/resume-almedalen-2026/data.js', 'utf8');
const data = JSON.parse(src.match(/window\.DATA\s*=\s*(\{.*\});/s)[1]);
const listed = data.totalt.map(r => ({ namn: r.namn, sem: r.sem }));
const norms = [...new Set(listed.map(r => r.namn.toLowerCase().trim()))];

const sp = await fa('speakers', 'id,name,name_normalized', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const es = await fa('event_speakers', 'event_id,speaker_id', 'speaker_id', sp.map(s => s.id), ['event_id']);
const evIds = [...new Set(es.map(r => r.event_id))];
const ea = await fa('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const primary = new Map(); for (const r of ea) { if (r.is_primary || !primary.has(r.event_id)) primary.set(r.event_id, r.arranger_id); }
const arr = await fa('arrangers', 'id,name', 'id', [...new Set(ea.map(r => r.arranger_id))], ['id']);
const arrName = new Map(arr.map(a => [a.id, a.name]));

// per norm: arrangörhistogram över personens distinkta event
const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }

const isCommon = nm => { const t = nm.split(/\s+/); return COMMON_SUR.has(t[t.length - 1]) || COMMON_FIRST.has(t[0]); };
const rows = [];
for (const r of listed) {
  const nm = r.namn.toLowerCase().trim();
  const evs = [...(evByNorm.get(nm) || [])];
  const hist = {}; for (const e of evs) { const a = arrName.get(primary.get(e)) || 'okänd'; hist[a] = (hist[a] || 0) + 1; }
  const sorted = Object.entries(hist).sort((a, b) => b[1] - a[1]);
  const top = sorted[0] || ['—', 0];
  const topShare = evs.length ? top[1] / evs.length : 0;
  rows.push({ namn: r.namn, sem: r.sem, distinct: evs.length, topShare, topArr: top[0], topCnt: top[1], second: sorted[1], nArr: sorted.length, common: isCommon(nm) });
}

const suspects = rows.filter(r => r.common && r.topShare < 0.5 && r.sem >= 8).sort((a, b) => b.sem - a.sem);
console.log(`Listan: ${rows.length} personer. Misstänkta (vanligt namn + spritt <50% + ≥8 sem): ${suspects.length}\n`);
console.log('NAMN                     LISTAT  DOMINANT-KLUSTER (≈avsedd person)        SPRIDNING');
for (const s of suspects) {
  console.log(`${s.namn.padEnd(24)} ${String(s.sem).padStart(4)}   ${(s.topCnt+' '+s.topArr).slice(0,38).padEnd(38)} ${s.nArr} arr, topp ${(s.topShare*100).toFixed(0)}%`);
}

// READ-ONLY: dumpa misstänkta namns faktiska seminarier (år, arrangör, titel)
// för bedömning en-person-vs-hopslagning. → source/name_suspects.json
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fa(t, sel, col, vals, oc) { let out = []; for (const c of chunk(vals, 60)) { let f = 0; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data } = await q.range(f, f + 999); out.push(...data); if (data.length < 1000) break; f += 1000; } } return out; }

const COMMON_SUR = new Set(['andersson','johansson','karlsson','nilsson','eriksson','larsson','olsson','persson','svensson','gustafsson','pettersson','jonsson','jansson','hansson','bengtsson','lindberg','lindström','lindgren','axelsson','berg','lund','nyberg','holm','nyström','lindqvist','magnusson','olofsson','jakobsson','wallin','henriksson','ohlsson','sandberg','forsberg','sjöberg','wikström','engström','danielsson','håkansson','löfgren','bergström','mattsson','johnsson','hermansson','fredriksson','arvidsson','blom','nordström','holmberg','lundberg']);
const COMMON_FIRST = new Set(['anna','maria','johan','anders','per','lars','karin','erik','eva','sara','emma','mikael','fredrik','jonas','andreas','thomas','daniel','david','martin','henrik','peter','jan','sofia','linda','helena','malin','sandra','jenny','emelie','hanna','kristina','marie','ulrika','christer','mats','niklas','magnus','jakob','stefan','mattias']);
const isCommon = nm => { const t = nm.split(/\s+/); return COMMON_SUR.has(t[t.length - 1]) || COMMON_FIRST.has(t[0]); };

const data = JSON.parse(readFileSync('/Users/jakobohlsson/resume-almedalen-2026/data.js', 'utf8').match(/window\.DATA\s*=\s*(\{.*\});/s)[1]);
const meta = new Map(data.totalt.map(r => [r.namn, r]));

const norms = [...new Set(data.totalt.map(r => r.namn.toLowerCase().trim()))];
const sp = await fa('speakers', 'id,name,name_normalized', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const es = await fa('event_speakers', 'event_id,speaker_id', 'speaker_id', sp.map(s => s.id), ['event_id']);
const evIds = [...new Set(es.map(r => r.event_id))];
const events = await fa('events', 'id,year,title', 'id', evIds, ['id']);
const evById = new Map(events.map(e => [e.id, e]));
const ea = await fa('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const primary = new Map(); for (const r of ea) { if (r.is_primary || !primary.has(r.event_id)) primary.set(r.event_id, r.arranger_id); }
const arr = await fa('arrangers', 'id,name', 'id', [...new Set(ea.map(r => r.arranger_id))], ['id']);
const arrName = new Map(arr.map(a => [a.id, a.name]));

const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }

const out = [];
for (const r of data.totalt) {
  const nm = r.namn.toLowerCase().trim();
  const evs = [...(evByNorm.get(nm) || [])];
  const hist = {}; for (const e of evs) { const a = arrName.get(primary.get(e)) || 'okänd'; hist[a] = (hist[a] || 0) + 1; }
  const topShare = evs.length ? Math.max(...Object.values(hist)) / evs.length : 0;
  if (!(isCommon(nm) && topShare < 0.5 && r.sem >= 8)) continue;
  const sems = evs.map(e => ({ year: evById.get(e)?.year, arr: arrName.get(primary.get(e)) || '?', title: (evById.get(e)?.title || '').slice(0, 60) }))
    .sort((a, b) => (a.year - b.year) || a.arr.localeCompare(b.arr));
  out.push({ namn: r.namn, titel: r.titel || '', org: r.org || '', listad_sem: r.sem, seminarier: sems });
}
writeFileSync('/Users/jakobohlsson/almedalen-appen/source/name_suspects.json', JSON.stringify(out, null, 1));
console.log(`Dumpade ${out.length} misstänkta med seminarier → source/name_suspects.json`);

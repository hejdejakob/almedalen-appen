// READ-ONLY: bygg master-underlag per person (koncentration + titelkvalitet).
// Skriver resume-almedalen-2026/source/audit_master.json — urval för enrichment.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fetchAll(t, sel, col, vals, oc) {
  let out = [];
  for (const c of chunk(vals, 40)) { let f = 0; const s = 1000; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data, error } = await q.range(f, f + s - 1); if (error) { console.error(t, error.message); break; } out.push(...data); if (data.length < s) break; f += s; } }
  return out;
}

const seed = JSON.parse(readFileSync('/Users/jakobohlsson/resume-almedalen-2026/source/enrichment_seed.json', 'utf8'));
const norms = [...new Set(seed.map(s => s.namn.toLowerCase().trim()))];
const sp = await fetchAll('speakers', 'id,name,name_normalized', 'name_normalized', norms, ['id']);
const normById = new Map(sp.map(s => [s.id, s.name_normalized]));
const allIds = sp.map(s => s.id);
const es = await fetchAll('event_speakers', 'event_id,speaker_id', 'speaker_id', allIds, ['event_id', 'speaker_id']);
const evIds = [...new Set(es.map(r => r.event_id))];
const ea = await fetchAll('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const arrs = await fetchAll('arrangers', 'id,name', 'id', [...new Set(ea.map(r => r.arranger_id))], ['id']);
const arrName = new Map(arrs.map(a => [a.id, a.name]));
const primaryArr = new Map();
for (const r of ea) { if (r.is_primary || !primaryArr.has(r.event_id)) primaryArr.set(r.event_id, r.arranger_id); }
const evByNorm = new Map();
for (const r of es) { const nm = normById.get(r.speaker_id); if (!nm) continue; (evByNorm.get(nm) || evByNorm.set(nm, new Set()).get(nm)).add(r.event_id); }

const isJunk = t => { t = (t || '').trim(); if (!t) return true; return /[#0-9]/.test(t) || /\bmoderator\b/i.test(t) || /\b(vår|höst)\b/i.test(t) || /superkommunikat/i.test(t) || /\btalare\b/i.test(t) || t.length > 55; };

const master = seed.map(s => {
  const nm = s.namn.toLowerCase().trim();
  const evs = [...(evByNorm.get(nm) || [])];
  const hist = {};
  for (const e of evs) { const a = primaryArr.get(e) ?? 'okänd'; hist[a] = (hist[a] || 0) + 1; }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const sem = evs.length;
  const topShare = sem ? top[1] / sem : 0;
  return {
    namn: s.namn, kategori: s.kategori, sem,
    frusen_titel: s.frusen_titel, frusen_org: s.frusen_org,
    vanligt_namn: s.vanligt_namn,
    topShare: Math.round(topShare * 100) / 100,
    distinkta_arrangorer: Object.keys(hist).length,
    topp_arrangor: arrName.get(top[0]) || '',
    koncentrerad: topShare >= 0.5,
    junk_titel: isJunk(s.frusen_titel),
  };
});
writeFileSync('/Users/jakobohlsson/resume-almedalen-2026/source/audit_master.json', JSON.stringify(master, null, 1));

const junk = master.filter(m => m.junk_titel);
const dispCommon = master.filter(m => !m.koncentrerad && m.vanligt_namn);
const prioriterad = master.filter(m => m.junk_titel || (!m.koncentrerad && m.vanligt_namn));
console.log(`Skrev audit_master.json — ${master.length} personer`);
console.log(`Koncentrerade (en person, säker): ${master.filter(m => m.koncentrerad).length}`);
console.log(`Skräp/event-titel: ${junk.length}`);
console.log(`Spridd + vanligt namn (identitet osäker): ${dispCommon.length}`);
console.log(`PRIORITERAD enrichment (union): ${prioriterad.length}`);

// READ-ONLY: kan vi urskilja olika individer bakom ett hopslaget namn?
// Drar upp alla seminarier för givna namn med arrangör + ämne + raw_mention.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
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
      out.push(...data); if (data.length < size) break; from += size;
    }
  }
  return out;
}

const TARGETS = ['Karin Olsson', 'Andreas Johansson', 'Niklas Johansson'];
const norms = TARGETS.map(n => n.toLowerCase().trim());
const sp = await fetchAll('speakers', 'id,name,name_normalized,title', 'name_normalized', norms, ['id']);
const idByNorm = new Map(); for (const s of sp) (idByNorm.get(s.name_normalized) || idByNorm.set(s.name_normalized, []).get(s.name_normalized)).push(s.id);
const allIds = sp.map(s => s.id);

const es = await fetchAll('event_speakers', 'event_id,speaker_id,raw_mention', 'speaker_id', allIds, ['event_id', 'speaker_id']);
const evIds = [...new Set(es.map(r => r.event_id))];
const events = await fetchAll('events', 'id,title,year', 'id', evIds, ['id']);
const evById = new Map(events.map(e => [e.id, e]));
const ea = await fetchAll('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const arrIds = [...new Set(ea.map(r => r.arranger_id))];
const arrs = await fetchAll('arrangers', 'id,name', 'id', arrIds, ['id']);
const arrName = new Map(arrs.map(a => [a.id, a.name]));
const primaryArr = new Map();
for (const r of ea) { if (r.is_primary || !primaryArr.has(r.event_id)) primaryArr.set(r.event_id, arrName.get(r.arranger_id) || '?'); }
let topics = [];
try { topics = await fetchAll('event_topics', 'event_id,topic_primary', 'event_id', evIds, ['event_id']); } catch (e) {}
const topicBy = new Map(topics.map(t => [t.event_id, t.topic_primary]));

const esBySpk = new Map();
for (const r of es) (esBySpk.get(r.speaker_id) || esBySpk.set(r.speaker_id, []).get(r.speaker_id)).push(r);

for (const name of TARGETS) {
  const nm = name.toLowerCase().trim();
  const ids = idByNorm.get(nm) || [];
  const rows = ids.flatMap(id => esBySpk.get(id) || []);
  const evs = [...new Set(rows.map(r => r.event_id))].map(eid => ({
    eid, ...evById.get(eid), arr: primaryArr.get(eid) || '?', topic: topicBy.get(eid) || '',
    mention: (rows.find(r => r.event_id === eid) || {}).raw_mention || '',
  })).sort((a, b) => (a.year - b.year) || (a.arr || '').localeCompare(b.arr || ''));
  const distinctMentions = [...new Set(rows.map(r => (r.raw_mention || '').trim()))];
  console.log(`\n================ ${name} ================`);
  console.log(`talarpost(er): ${ids.length} · distinkta seminarier: ${evs.length} · lagrad title: "${sp.find(s => s.id === ids[0])?.title || ''}"`);
  console.log(`distinkta raw_mention-värden: ${distinctMentions.length} → ${JSON.stringify(distinctMentions).slice(0, 200)}`);
  // klustra på arrangör
  const byArr = {};
  for (const e of evs) byArr[e.arr] = (byArr[e.arr] || 0) + 1;
  console.log(`arrangörer (${Object.keys(byArr).length} st):`);
  Object.entries(byArr).sort((a, b) => b[1] - a[1]).forEach(([a, c]) => console.log(`   ${String(c).padStart(2)} × ${a}`));
  console.log(`seminarier (år · arrangör · ämne · titel):`);
  evs.forEach(e => console.log(`   ${e.year} · ${(e.arr || '?').slice(0, 26).padEnd(26)} · ${(e.topic || '').slice(0, 18).padEnd(18)} · ${(e.title || '').slice(0, 50)}`));
}

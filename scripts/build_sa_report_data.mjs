// Build data for the SäkerhetsArenan report (Reform Society → SäkerhetsBranschen).
// Report-layer consolidation only — the Supabase source data is NOT modified here.
// Output: scripts/sa_report_data.json (committed, drives public/sakerhetsarenan.html)
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function all(t, sel, idc = 'id', mod = q => q) {
  let o = [], f = 0, s = 1000;
  for (;;) {
    const { data, error } = await mod(db.from(t).select(sel).order(idc, { ascending: true }).range(f, f + s - 1));
    if (error) { console.error(t, error.message); break; }
    o.push(...data); if (data.length < s) break; f += s;
  }
  return o;
}

const YEARS = [2022, 2023, 2024, 2025, 2026];
// SäkerhetsBranschen + the 6 SäkerhetsArenan partners.
const MEMBER_TERMS = [
  'SäkerhetsBranschen', 'Säkerhetsarenan', 'Stöldskyddsföreningen',
  'Brandskyddsföreningen', 'Tryggare Sverige', 'Almega Säkerhetsföretagen',
  'Företagsuniversitetet',
];
const low = s => (s || '').toLowerCase();
const hits = n => MEMBER_TERMS.filter(t => low(n).includes(low(t))).length;
const hasArena = n => low(n).includes('säkerhetsarenan');

const arrangers = await all('arrangers', 'id,name,first_seen_year');
const family = arrangers.filter(a => hits(a.name) >= 1);
const familyIds = new Set(family.map(a => a.id));
// "Core" = the branded arena concept: rows naming Säkerhetsarenan OR listing >=3 partners together.
const core = family.filter(a => hasArena(a.name) || hits(a.name) >= 3);
const coreIds = new Set(core.map(a => a.id));

const ea = await all('event_arrangers', 'event_id,arranger_id', 'event_id');
const familyEvents = new Set(), coreEvents = new Set();
for (const l of ea) {
  if (familyIds.has(l.arranger_id)) familyEvents.add(l.event_id);
  if (coreIds.has(l.arranger_id)) coreEvents.add(l.event_id);
}

const events = await all('events', 'id,year,title');
const evById = new Map(events.map(e => [e.id, e]));
const perYear = set => { const o = {}; YEARS.forEach(y => o[y] = 0); for (const id of set) { const e = evById.get(id); if (e && o[e.year] != null) o[e.year]++; } return o; };

const topics = await all('event_topics', 'id,event_id,topic_primary');
const topicOf = new Map(topics.map(t => [t.event_id, t.topic_primary]));

// Macro: försvar_säkerhet as primary topic, per year, + total events per year.
const totByYear = {}; YEARS.forEach(y => totByYear[y] = 0);
for (const e of events) if (totByYear[e.year] != null) totByYear[e.year]++;
const defByYear = {}; YEARS.forEach(y => defByYear[y] = 0);
for (const t of topics) if (t.topic_primary === 'försvar_säkerhet') { const e = evById.get(t.event_id); if (e && defByYear[e.year] != null) defByYear[e.year]++; }

// Topic mix of the family's seminars.
const famTopics = {};
for (const id of familyEvents) { const t = topicOf.get(id); if (t) famTopics[t] = (famTopics[t] || 0) + 1; }

// Jeanette (5886 + 10392 consolidated).
const jIds = [5886, 10392];
const esJ = await all('event_speakers', 'event_id,speaker_id', 'event_id', q => q.in('speaker_id', jIds));
const jByYear = {}; YEARS.forEach(y => jByYear[y] = 0);
for (const r of esJ) { const e = evById.get(r.event_id); if (e && jByYear[e.year] != null) jByYear[e.year]++; }

// Top speakers at family events, consolidated by normalized name.
const esAll = await all('event_speakers', 'event_id,speaker_id', 'event_id');
const cnt = {};
for (const r of esAll) if (familyEvents.has(r.event_id)) cnt[r.speaker_id] = (cnt[r.speaker_id] || 0) + 1;
const speakers = await all('speakers', 'id,name,name_normalized,title,org_name');
const sp = new Map(speakers.map(s => [s.id, s]));
const byNorm = {};
for (const [sid, c] of Object.entries(cnt)) {
  const s = sp.get(parseInt(sid)); if (!s) continue;
  const k = s.name_normalized || low(s.name);
  if (!byNorm[k]) byNorm[k] = { name: s.name, title: s.title, org: s.org_name, count: 0, merged: 0 };
  byNorm[k].count += c; byNorm[k].merged++;
}
const fixVd = t => !t ? t : t.replace(/^vd$/i, 'VD').replace(/\bvd\b/g, 'VD');
const topSpeakers = Object.values(byNorm)
  .sort((a, b) => b.count - a.count).slice(0, 12)
  .map(s => ({ name: s.name, title: fixVd(s.title) || '—', org: s.org || '—', count: s.count, merged: s.merged > 1 }));

const data = {
  generated: 'report-layer consolidation; Supabase source unchanged',
  years: YEARS,
  macro: { defByYear, totByYear, sharePct: Object.fromEntries(YEARS.map(y => [y, totByYear[y] ? +(100 * defByYear[y] / totByYear[y]).toFixed(1) : 0])) },
  family: { eventsByYear: perYear(familyEvents), total: familyEvents.size, arrangerRows: family.length },
  core: { total: coreEvents.size, firstYear: 2023, note: 'Paraplynamnet "Säkerhetsarenan" användes 2023–2024; därefter taggades samma verksamhet under medlemsorganisationerna. Kärnsiffran redovisas därför kumulativt, inte som årskurva.' },
  topicMix: Object.entries(famTopics).sort((a, b) => b[1] - a[1]).map(([topic, n]) => ({ topic, n })),
  jeanette: { byYear: jByYear, total: esJ.length },
  topSpeakers,
};
writeFileSync(new URL('./sa_report_data.json', import.meta.url), JSON.stringify(data, null, 2));
console.log('Skrev scripts/sa_report_data.json');
console.log('Familj/år:', data.family.eventsByYear, '· total', data.family.total, '· kärna kumulativt', data.core.total);
console.log('Makro försvar_säkerhet/år:', data.macro.defByYear);
console.log('Jeanette total:', data.jeanette.total, data.jeanette.byYear);
console.log('Topp 3 talare:', data.topSpeakers.slice(0, 3).map(s => `${s.name} (${s.count})`).join(', '));

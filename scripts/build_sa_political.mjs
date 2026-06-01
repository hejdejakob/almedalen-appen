// Political (left-right / GAL-TAN) profile of speakers at the security family's seminars.
// Mirrors matchParty() + CHES_SCORES from app/api/arrangers/route.ts.
// Report-layer only; Supabase unchanged.
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

// CHES 2024 SE party scores (0-10). lrecon = economic left(0)-right(10); galtan = GAL(0)-TAN(10).
const CHES = {
  V:  { lrecon: 1.89, galtan: 2.42, name: 'Vänsterpartiet' },
  SAP:{ lrecon: 3.68, galtan: 4.74, name: 'Socialdemokraterna' },
  MP: { lrecon: 3.16, galtan: 1.95, name: 'Miljöpartiet' },
  C:  { lrecon: 7.84, galtan: 2.95, name: 'Centerpartiet' },
  L:  { lrecon: 7.32, galtan: 4.47, name: 'Liberalerna' },
  M:  { lrecon: 7.89, galtan: 6.47, name: 'Moderaterna' },
  KD: { lrecon: 7.26, galtan: 7.79, name: 'Kristdemokraterna' },
  SD: { lrecon: 6.32, galtan: 9.00, name: 'Sverigedemokraterna' },
};
const BLOCK = { V:'vänster', SAP:'vänster', MP:'vänster', C:'höger', L:'höger', M:'höger', KD:'höger', SD:'höger' };

function matchParty(org) {
  if (!org) return null;
  const l = org.toLowerCase();
  if (/moderaterna|\(m\)|moderata/.test(l)) return 'M';
  if (/socialdemokraterna|\(s\)\s|socialdemokrat/.test(l)) return 'SAP';
  if (/sverigedemokraterna|\(sd\)/.test(l)) return 'SD';
  if (/centerpartiet|\(c\)/.test(l)) return 'C';
  if (/vänsterpartiet|\(v\)/.test(l)) return 'V';
  if (/liberalerna|\(l\)|folkpartiet/.test(l)) return 'L';
  if (/kristdemokraterna|\(kd\)/.test(l)) return 'KD';
  if (/miljöpartiet|\(mp\)/.test(l)) return 'MP';
  return null;
}

const MEMBER = ['säkerhetsbranschen','säkerhetsarenan','stöldskyddsföreningen','brandskyddsföreningen','tryggare sverige','almega säkerhetsföretagen','företagsuniversitetet'];
const hits = n => MEMBER.filter(t => (n||'').toLowerCase().includes(t)).length;

const arrangers = await all('arrangers', 'id,name');
const familyIds = new Set(arrangers.filter(a => hits(a.name) >= 1).map(a => a.id));
const ea = await all('event_arrangers', 'event_id,arranger_id', 'event_id');
const familyEvents = new Set(ea.filter(l => familyIds.has(l.arranger_id)).map(l => l.event_id));

const es = await all('event_speakers', 'event_id,speaker_id', 'event_id');
const speakers = await all('speakers', 'id,name,name_normalized,title,org_name');
const sp = new Map(speakers.map(s => [s.id, s]));

// appearances per speaker at family events
const appByName = {};
let totalAppearances = 0;
for (const r of es) {
  if (!familyEvents.has(r.event_id)) continue;
  const s = sp.get(r.speaker_id); if (!s) continue;
  totalAppearances++;
  const key = s.name_normalized || (s.name||'').toLowerCase();
  if (!appByName[key]) appByName[key] = { name: s.name, org: s.org_name, title: s.title, party: matchParty(s.org_name), count: 0 };
  appByName[key].count++;
}

const all_ = Object.values(appByName);
const politicians = all_.filter(p => p.party);
const distinctSpeakers = all_.length;

// aggregate per party: distinct politicians + appearances
const perParty = {};
for (const p of politicians) {
  const k = p.party;
  if (!perParty[k]) perParty[k] = { party: k, name: CHES[k].name, lrecon: CHES[k].lrecon, galtan: CHES[k].galtan, block: BLOCK[k], politicians: 0, appearances: 0, people: [] };
  perParty[k].politicians++;
  perParty[k].appearances += p.count;
  perParty[k].people.push({ name: p.name, title: p.title, count: p.count });
}
const partyRows = Object.values(perParty).sort((a,b) => b.appearances - a.appearances);

// weighted left-right index (by appearances): mean lrecon, mean galtan
let wl = 0, wg = 0, wn = 0;
for (const r of partyRows) { wl += r.lrecon * r.appearances; wg += r.galtan * r.appearances; wn += r.appearances; }
const blockApp = { vänster:0, höger:0 };
for (const r of partyRows) blockApp[r.block] += r.appearances;

const out = {
  generated: 'report-layer; CHES 2024 SE; matchParty mirrors arrangers route',
  familyEvents: familyEvents.size,
  totalAppearances,
  distinctSpeakers,
  politicianAppearances: politicians.reduce((s,p)=>s+p.count,0),
  distinctPoliticians: politicians.length,
  partyRows,
  weighted: { lrecon: +(wl/wn).toFixed(2), galtan: +(wg/wn).toFixed(2), n: wn },
  blockApp,
};
writeFileSync(new URL('./sa_political_data.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(`familyEvents=${familyEvents.size} totalApp=${totalAppearances} distinctSpeakers=${distinctSpeakers}`);
console.log(`distinctPoliticians=${politicians.length} politicianAppearances=${out.politicianAppearances}`);
console.log('Per parti (appearances):');
for (const r of partyRows) console.log(`  ${r.party.padEnd(4)} ${r.name.padEnd(20)} lr=${r.lrecon} gt=${r.galtan} block=${r.block.padEnd(8)} pol=${r.politicians} app=${r.appearances}`);
console.log('Block (appearances):', blockApp);
console.log('Viktad position: lrecon', out.weighted.lrecon, 'galtan', out.weighted.galtan);

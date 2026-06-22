// READ-ONLY scouting: dra ut kandidatpass för Better Shelter-vd:n ur 2026.
// Bred recall (relevanstema) + "utrymme"-flagga (få talare ELLER öppet format).
// Skriver source/bs_candidates.json för LLM-bedömning.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fa(t, sel, col, vals, oc) { let out = []; for (const c of chunk(vals, 60)) { let f = 0; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data } = await q.range(f, f + 999); out.push(...data); if (data.length < 1000) break; f += 1000; } } return out; }
async function allYear(t, sel, y) { let out = []; let f = 0; for (;;) { const { data } = await db.from(t).select(sel).eq('year', y).range(f, f + 999); out.push(...data); if (data.length < 1000) break; f += 1000; } return out; }

const events = await allYear('events', 'id,title,description,topic_pdf_original,secondary_topic,event_type,day_of_week,start_time,end_time,location_name,url', 2026);
const evIds = events.map(e => e.id);
const es = await fa('event_speakers', 'event_id,speaker_id', 'event_id', evIds, ['event_id']);
const ea = await fa('event_arrangers', 'event_id,arranger_id,is_primary', 'event_id', evIds, ['event_id']);
const spk = await fa('speakers', 'id,name', 'id', [...new Set(es.map(r => r.speaker_id))], ['id']);
const arr = await fa('arrangers', 'id,name', 'id', [...new Set(ea.map(r => r.arranger_id))], ['id']);
const spkName = new Map(spk.map(s => [s.id, s.name]));
const arrName = new Map(arr.map(a => [a.id, a.name]));
const spByEv = new Map(); for (const r of es) { (spByEv.get(r.event_id) || spByEv.set(r.event_id, []).get(r.event_id)).push(spkName.get(r.speaker_id)); }
const arByEv = new Map(); for (const r of ea) { const l = arByEv.get(r.event_id) || []; const n = arrName.get(r.arranger_id); if (n) (r.is_primary ? l.unshift(n) : l.push(n)); arByEv.set(r.event_id, l); }

// Bred relevans-recall (sv+en). Bedömning av NISCHEN görs sedan av LLM.
// Skärpt: ankra STRIKT i humanitärt bistånd / flykting / katastrof / utveckling.
// (Inget bygg/bostad/housing/hälsa/allmän-innovation som drog in brus förra gången.)
const RX = /bistånd|utvecklingssamarbete|utvecklingspolitik|humanitär|flykting|\basyl|migration|fördriv|internflykt|katastrof|nödhjälp|nödbist|krisrespons|konflikt|\bkrig\b|Sudan|Gaza|Ukraina|Syrien|Afghanistan|Jemen|Sahel|Östafrika|Mellanöstern|UNHCR|\bWFP\b|UNICEF|\bOCHA\b|\bSida\b|\bFN(:s| )|fattigdom|svält|fördrivna|displacement|refugee|humanitarian|social innovation|socialt företag|civilsamh|\bNGO\b|IKEA Foundation|återuppbygg/i;
const OPEN = /mingel|rundabord|runda bord|öppet samtal|öppet hus|frukost|after ?work|\bAW\b|drop-?in|nätverk|\bsamtal\b/i;
const hm = iso => iso ? new Date(iso).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' }) : '';

const cands = [];
for (const e of events) {
  const hay = `${e.title || ''} ${e.description || ''} ${e.topic_pdf_original || ''} ${e.secondary_topic || ''}`;
  if (!RX.test(hay)) continue;
  const speakers = (spByEv.get(e.id) || []).filter(Boolean);
  const openFmt = OPEN.test(`${e.title || ''} ${e.event_type || ''}`);
  const room = speakers.length <= 6 || openFmt; // lättare tröskel — bedömningen flaggar utrymmet
  if (!room) continue; // bara pass med rimligt utrymme
  cands.push({
    eventId: e.id, title: e.title, desc: (e.description || '').slice(0, 320),
    topic: e.topic_pdf_original, eventType: e.event_type,
    day: e.day_of_week, time: `${hm(e.start_time)}–${hm(e.end_time)}`,
    location: e.location_name, url: e.url,
    speakerCount: speakers.length, speakers: speakers.slice(0, 12),
    arrangers: (arByEv.get(e.id) || []).slice(0, 4), openFormat: openFmt,
  });
}
writeFileSync('/Users/jakobohlsson/almedalen-appen/source/bs_candidates.json', JSON.stringify(cands, null, 1));
console.log(`2026-events: ${events.length}`);
console.log(`Kandidater (relevant tema + utrymme): ${cands.length}`);
console.log(`  varav öppet format: ${cands.filter(c => c.openFormat).length}, få talare (≤3): ${cands.filter(c => c.speakerCount <= 3).length}`);
console.log(`Talarantal-fördelning:`, [0, 1, 2, 3].map(n => `${n}:${cands.filter(c => c.speakerCount === n).length}`).join(' '));

// READ-ONLY: bekräfta person → 2026-schema-join + sökbart universum.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
async function fetchAll(t, sel, col, vals, oc) { let out = []; for (const c of chunk(vals, 40)) { let f = 0; for (;;) { let q = db.from(t).select(sel).in(col, c); for (const o of oc) q = q.order(o, { ascending: true }); const { data, error } = await q.range(f, f + 999); if (error) { console.error(t, error.message); break; } out.push(...data); if (data.length < 1000) break; f += 1000; } } return out; }

// 2026-events
const ev2026 = await fetchAll('events', 'id,title,start_time,end_time,day_of_week,location_name,event_type', 'year', [2026], ['id']);
const evById = new Map(ev2026.map(e => [e.id, e]));
console.log(`2026-events: ${ev2026.length}`);

// kopplingar för 2026-events
const links = await fetchAll('event_speakers', 'event_id,speaker_id', 'event_id', ev2026.map(e => e.id), ['event_id']);
const speakersWith2026 = new Set(links.map(l => l.speaker_id));
console.log(`Personer (speaker_id) med ≥1 2026-framträdande: ${speakersWith2026.size}`);

// person med flest 2026-framträdanden
const cnt = {}; for (const l of links) cnt[l.speaker_id] = (cnt[l.speaker_id] || 0) + 1;
const topId = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0][0];
const { data: sp } = await db.from('speakers').select('id,name,title,org_name').eq('id', topId);
const person = sp[0];
console.log(`\n=== EXEMPELSCHEMA: ${person.name} (${person.title || ''} ${person.org_name || ''}) — ${cnt[topId]} framträdanden 2026 ===`);
const myEvents = links.filter(l => l.speaker_id == topId).map(l => evById.get(l.event_id)).filter(Boolean)
  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
let day = '';
for (const e of myEvents) {
  const d = e.day_of_week || e.start_time?.slice(0, 10);
  if (d !== day) { day = d; console.log(`\n  ── ${day} ──`); }
  const t = e.start_time ? new Date(e.start_time).toISOString().slice(11, 16) : '??';
  const te = e.end_time ? new Date(e.end_time).toISOString().slice(11, 16) : '';
  console.log(`  ${t}-${te}  ${(e.location_name || '?').slice(0, 28).padEnd(28)} ${(e.title || '').slice(0, 46)}`);
}

// hur många "minister"-aktiga finns i 2026? (title-sök på speakers med 2026-events)
const spAll = await fetchAll('speakers', 'id,name,title', 'id', [...speakersWith2026], ['id']);
const ministers = spAll.filter(s => /minister|statssekreterare|statsråd/i.test(s.title || ''));
console.log(`\n=== "Minister/statsråd"-titlar bland 2026-personer (via fryst title): ${ministers.length} ===`);
ministers.slice(0, 12).forEach(s => console.log(`  ${s.name} — ${s.title}`));

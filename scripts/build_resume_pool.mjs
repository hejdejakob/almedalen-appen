// Bygg klassningspool för Resumé-kategorierna. READ-ONLY mot Supabase.
// Skriver batch-filer (lokal JSON) med talare + kontext (titel, org, panels,
// exempel på seminarie-titlar) som klassningsagenter läser.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function all(t, sel, idc = 'id', mod = q => q) {
  let o = [], f = 0, s = 1000;
  for (;;) { const { data, error } = await mod(db.from(t).select(sel).order(idc, { ascending: true }).range(f, f + s - 1));
    if (error) { console.error(t, error.message); break; } o.push(...data); if (data.length < s) break; f += s; }
  return o;
}
const low = s => (s || '').toLowerCase();

// Recall-bred nyckelordsfilter (titel ELLER org) — fångar alla som rimligen
// kan nå topp-30 i någon av de 17 kommunikations-/PA-/media-kategorierna.
const TITLE_KW = ['kommunikat','kommunika','press','talesperson','talesman','public affairs','samhällspolit','samhällskontakt','samhällsrelation','påverkan','opinionsbild','lobby','byrå','pr-','pr konsult','reklam','chefredaktör','redaktionschef','ansvarig utgivare','redaktör','journalist','reporter','kommentator','krönikör','ledarskribent','moderator','programledare','marknadschef','marknadsdirektör','marknadsansvarig','cmo','brand director','varumärke','hållbarhet','csr','sverigechef','landschef','country manager','nordenchef','informationschef','informationsdirektör','informatör','presskontakt','pressekr','pressansvar','pressekreterare','politiskt sakkunnig','stabschef','generalsekreterare','opinion','head of communication','communications','public relations','corporate affairs','external relations','government relations','policy'];
const ORG_KW = ['kommunikationsbyrå','pr-byrå','reklambyrå','prime','weber shandwick','kreab','rud pedersen','hallvarsson','narva','jung relations','gullers','springtime','westander','paues','geelmuyden','diplomat communications','nordic public affairs','meta','google','microsoft','apple','amazon','tiktok','pwc','ey ','deloitte','kpmg','edelman','burson'];
const isCand = s => { const t = low(s.title), o = low(s.org_name); return TITLE_KW.some(k => t.includes(k)) || ORG_KW.some(k => o.includes(k)); };

const speakers = await all('speakers', 'id,name,name_normalized,title,org_name');
const stats = await all('speaker_stats', 'speaker_id,panel_count', 'speaker_id');
const panels = {}; for (const r of stats) panels[r.speaker_id] = (panels[r.speaker_id] || 0) + (r.panel_count || 0);

// kontext: ett par seminarie-titlar per talare (vad de faktiskt gjorde)
const es = await all('event_speakers', 'event_id,speaker_id', 'event_id');
const events = await all('events', 'id,title');
const evTitle = new Map(events.map(e => [e.id, e.title]));
const ctxByS = {};
for (const r of es) { (ctxByS[r.speaker_id] = ctxByS[r.speaker_id] || []).push(evTitle.get(r.event_id)); }

const pool = speakers.filter(isCand).map(s => ({
  id: s.id, name: s.name, title: s.title || '', org: s.org_name || '',
  panels: panels[s.id] || 0,
  seminars: (ctxByS[s.id] || []).filter(Boolean).slice(0, 5).map(t => (t || '').slice(0, 70)),
})).filter(c => c.panels >= 2)         // topp-30 hamnar aldrig under 2 paneler
  .sort((a, b) => b.panels - a.panels);

mkdirSync(new URL('./resume_pool/', import.meta.url), { recursive: true });
const BATCH = 120;
let n = 0;
for (let i = 0; i < pool.length; i += BATCH) {
  writeFileSync(new URL(`./resume_pool/batch_${n}.json`, import.meta.url), JSON.stringify(pool.slice(i, i + BATCH), null, 1));
  n++;
}
console.log(`Pool: ${pool.length} talare → ${n} batchar à ${BATCH}`);
console.log('Pilot = batch_0 (de ', Math.min(BATCH, pool.length), 'med flest paneler)');
console.log('Exempel:', JSON.stringify(pool[0]));

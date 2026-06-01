// Sentiment-data för rapporten (vinkel 1: er ton vs Almedalen; vinkel 2: tonkurva).
// READ-ONLY mot Supabase, skriver bara lokal JSON.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
config();
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function all(t, sel, idc='id', mod=q=>q){let o=[],f=0,s=1000;for(;;){const{data,error}=await mod(db.from(t).select(sel).order(idc,{ascending:true}).range(f,f+s-1));if(error){console.error(t,error.message);break;}o.push(...data);if(data.length<s)break;f+=s;}return o;}

const YEARS=[2022,2023,2024,2025,2026];
const sent = await all('event_sentiment','event_id,score,label,framing','event_id');
const sById = new Map(sent.map(s=>[s.event_id,s]));
const events = await all('events','id,year');
const yearOf = new Map(events.map(e=>[e.id,e.year]));
const topics = await all('event_topics','event_id,topic_primary');
const defIds = new Set(topics.filter(t=>t.topic_primary==='försvar_säkerhet').map(t=>t.event_id));

const MEMBER=['säkerhetsbranschen','säkerhetsarenan','stöldskyddsföreningen','brandskyddsföreningen','tryggare sverige','almega säkerhetsföretagen','företagsuniversitetet'];
const hits=n=>MEMBER.filter(t=>(n||'').toLowerCase().includes(t)).length;
const arrangers=await all('arrangers','id,name');
const famIds=new Set(arrangers.filter(a=>hits(a.name)>=1).map(a=>a.id));
const ea=await all('event_arrangers','event_id,arranger_id','event_id');
const famEvents=new Set(ea.filter(l=>famIds.has(l.arranger_id)).map(l=>l.event_id));

function agg(ids){
  let n=0,sum=0; const fr={solution:0,problem:0,neutral:0};
  for(const id of ids){const s=sById.get(id);if(!s)continue;n++;
    if(typeof s.score==='number')sum+=s.score;
    if(s.framing&&fr[s.framing]!=null)fr[s.framing]++;
  }
  const frN=fr.solution+fr.problem+fr.neutral;
  return {n, mean:n?+(sum/n).toFixed(3):null, solutionPct:frN?+(100*fr.solution/frN).toFixed(1):null, problemPct:frN?+(100*fr.problem/frN).toFixed(1):null};
}

const defArr=[...defIds];
const famDef=defArr.filter(id=>famEvents.has(id));
const otherDef=defArr.filter(id=>!famEvents.has(id));

// Vinkel 2: tonkurva (alla säkerhetsseminarier per år)
const curve = YEARS.map(y=>{const ids=defArr.filter(id=>yearOf.get(id)===y);return {year:y, ...agg(ids)};});

// Vinkel 1: er ton vs Almedalen (säkerhetssamtalet exkl. er)
const v1 = { customer: agg(famDef), almedalen: agg(otherDef) };

const out = { curve, compare:v1 };
writeFileSync(new URL('./sa_sentiment_data.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('=== VINKEL 2: tonkurva (alla säkerhetssem.) ===');
for(const c of curve) console.log(`  ${c.year}: mean=${c.mean} lösning=${c.solutionPct}% problem=${c.problemPct}% (n=${c.n})`);
console.log('\n=== VINKEL 1: er ton vs Almedalen ===');
console.log('  KUND     :', JSON.stringify(v1.customer));
console.log('  ALMEDALEN:', JSON.stringify(v1.almedalen));
console.log('\nSkrev scripts/sa_sentiment_data.json');

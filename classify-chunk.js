// Usage: node classify-chunk.js <chunk> <totalChunks>
// Example: node classify-chunk.js 1 10  (runs chunk 1 of 10)
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHUNK = parseInt(process.argv[2]) || 1;
const TOTAL_CHUNKS = parseInt(process.argv[3]) || 10;
const BATCH_SIZE = 30;

const VALID_SECTORS = {
  'näringsliv': ['bank_finans', 'försäkring', 'industri_tillverkning', 'handel', 'tech_it', 'fastighet', 'energi', 'transport', 'läkemedel_life_science', 'bygg_infrastruktur', 'livsmedel_jordbruk', 'övrigt_näringsliv'],
  'konsult_pr': ['konsult', 'pr_kommunikation', 'advokatbyrå', 'eventbyrå', 'rekrytering', 'analys_research'],
  'arbetsgivar_branschorg': ['arbetsgivarorganisation', 'branschförening'],
  'fackförbund': ['lo_förbund', 'tco_förbund', 'saco_förbund', 'annat_fack'],
  'civilsamhälle': ['folkrörelse_ideell', 'välgörenhet_ngo', 'patientorg', 'lobbygrupp_kampanj', 'studieförbund', 'trossamfund'],
  'tänketank_stiftelse': ['tänketank', 'stiftelse_fond'],
  'offentlig_sektor': ['statlig_myndighet', 'region', 'kommun', 'riksdag_regering', 'eu_internationell'],
  'parti': ['riksdagsparti', 'lokalt_parti', 'ungdomsförbund'],
  'media': ['dagstidning', 'public_service', 'branschmedia', 'digital_media'],
  'akademi': ['universitet_högskola', 'forskningsinstitut'],
};

const SYSTEM_PROMPT = `Du klassificerar svenska organisationer efter sektor och undersektor.
Du får namn, antal events, vanligaste ämnen och aktiva år som kontext.

10 SEKTORER (välj exakt en):

1. näringsliv — privata företag som säljer produkter/tjänster
   Sub: bank_finans, försäkring, industri_tillverkning, handel, tech_it, fastighet, energi, transport, läkemedel_life_science, bygg_infrastruktur, livsmedel_jordbruk, övrigt_näringsliv

2. konsult_pr — konsultfirmor, PR-byråer, advokatbyråer, eventarrangörer, analysföretag
   Sub: konsult, pr_kommunikation, advokatbyrå, eventbyrå, rekrytering, analys_research
   Exempel: Herr Omar, EY, PwC, Sweco, Business Arena, Coreco, Kantar Public, Svefa, Demoskop

3. arbetsgivar_branschorg — arbetsgivarorganisationer och branschföreningar för näringslivet
   Sub: arbetsgivarorganisation, branschförening
   Exempel: Almega, Svenskt Näringsliv, Teknikföretagen, Lif, IKEM, Svensk Handel

4. fackförbund — fackliga organisationer
   Sub: lo_förbund, tco_förbund, saco_förbund, annat_fack

5. civilsamhälle — folkrörelser, NGOs, ideella föreningar, lobbygrupper, patientorg
   Sub: folkrörelse_ideell, välgörenhet_ngo, patientorg, lobbygrupp_kampanj, studieförbund, trossamfund

6. tänketank_stiftelse — tankesmedjor, stiftelser, forskningsfonder
   Sub: tänketank, stiftelse_fond
   Exempel: Timbro, Arena Idé, Fores, Futurion, Humtank, Stiftelsen Tryggare Sverige

7. offentlig_sektor — myndigheter, kommuner, regioner, riksdag, EU
   Sub: statlig_myndighet, region, kommun, riksdag_regering, eu_internationell
   Exempel: Business Sweden, Vinnova, Region Gotland, MUCF, Almi

8. parti — politiska partier
   Sub: riksdagsparti, lokalt_parti, ungdomsförbund

9. media — tidningar, TV, branschmedia, digital media
   Sub: dagstidning, public_service, branschmedia, digital_media
   Exempel: Dagens industri, Expressen, SVT, Aktuell Hållbarhet, Dagens Medicin Agenda

10. akademi — universitet, högskolor, forskningsinstitut
    Sub: universitet_högskola, forskningsinstitut
    Exempel: Uppsala universitet, RISE, IVL, FOI

REGLER:
- Personnamn → konsult_pr/konsult
- sector och sub_sector MÅSTE vara från listan ovan
- Svara ENBART med JSON-array: [{"id": N, "sector": "...", "sub_sector": "...", "confidence": 0.0-1.0}]`;

async function fetchAll(table, columns) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data } = await supabase.from(table).select(columns).range(from, from + 999);
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function classifyBatch(items) {
  const input = items.map(a => ({
    id: a.id, name: a.name, events: a.event_count,
    topics: a.top_topics, years: a.years,
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Klassificera:\n${JSON.stringify(input, null, 1)}` }],
  });

  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON');
  const results = JSON.parse(match[0]);

  return results.filter(r => {
    if (VALID_SECTORS[r.sector]?.includes(r.sub_sector)) return true;
    console.error(`  INVALID: id=${r.id} ${r.sector}/${r.sub_sector}`);
    return false;
  });
}

async function main() {
  // Get all arrangers + context
  const arrangers = await fetchAll('arrangers', 'id, name');
  const allLinks = await fetchAll('event_arrangers', 'arranger_id, event_id');
  const allEvents = await fetchAll('events', 'id, topic_pdf_original, year');
  const eventMap = new Map(allEvents.map(e => [e.id, e]));

  const ctx = new Map();
  for (const link of allLinks) {
    if (!ctx.has(link.arranger_id)) ctx.set(link.arranger_id, { events: 0, topics: {}, years: new Set() });
    const c = ctx.get(link.arranger_id);
    c.events++;
    const ev = eventMap.get(link.event_id);
    if (ev) {
      if (ev.topic_pdf_original) c.topics[ev.topic_pdf_original] = (c.topics[ev.topic_pdf_original] || 0) + 1;
      c.years.add(ev.year);
    }
  }

  const enriched = arrangers.map(a => {
    const c = ctx.get(a.id) || { events: 0, topics: {}, years: new Set() };
    return {
      id: a.id, name: a.name, event_count: c.events,
      top_topics: Object.entries(c.topics).sort((a,b) => b[1]-a[1]).slice(0,3).map(([t]) => t).join(', ') || '(okänt)',
      years: [...c.years].sort().join(',') || '(okänt)',
    };
  });

  // Split into chunk
  const chunkSize = Math.ceil(enriched.length / TOTAL_CHUNKS);
  const start = (CHUNK - 1) * chunkSize;
  const end = Math.min(start + chunkSize, enriched.length);
  const myChunk = enriched.slice(start, end);

  console.log(`Chunk ${CHUNK}/${TOTAL_CHUNKS}: ${myChunk.length} arrangers (index ${start}-${end - 1})`);

  let classified = 0;
  let errors = 0;

  for (let i = 0; i < myChunk.length; i += BATCH_SIZE) {
    const batch = myChunk.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, myChunk.length)}/${myChunk.length}`);

    try {
      const results = await classifyBatch(batch);
      const upserts = results.map(r => ({
        arranger_id: r.id, sector: r.sector, sub_sector: r.sub_sector,
        confidence: r.confidence, method: 'sonnet_v2',
      }));

      const { error } = await supabase
        .from('arranger_classifications')
        .upsert(upserts, { onConflict: 'arranger_id' });

      if (error) { console.error(`\nDB error:`, error.message); errors++; }
      else classified += results.length;
    } catch (err) {
      console.error(`\nAPI error:`, err.message?.substring(0, 100));
      errors++;
    }
  }

  console.log(`\nChunk ${CHUNK} done: ${classified} classified, ${errors} errors.`);
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

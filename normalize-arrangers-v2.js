require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 30; // Smaller batches for Sonnet precision

// ============================================================
// TAXONOMY — strict, validated
// ============================================================
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

function isValidClassification(sector, sub_sector) {
  return VALID_SECTORS[sector]?.includes(sub_sector);
}

// ============================================================
// STEP 1: University merges (rule-based)
// ============================================================
const UNIVERSITIES = {
  'Uppsala universitet': [/\buppsala universitet/i, /\buppsala university/i, /\bu-fold vid uppsala/i, /\buppsala antibiotic center/i, /\buppsala co-creation/i, /\buppsala computing/i, /\buppsala centrum/i, /\bnationell bioinformatik/i, /\bnationell bioinformatikinfrastruktur/i],
  'Lunds universitet': [/\blunds universitet/i, /\blunds tekniska högskola\b/i, /\bai lund\b/i, /\bcentrum för mellanösternstudier/i, /\bcmes vid lunds/i, /\blth och cmes/i],
  'Göteborgs universitet': [/\bgöteborgs universitet/i, /\bsahlgrenska/i, /\bcentrum för personcentrerad vård/i, /\bgpcc\b/i, /\bhdk valand\b/i, /\bhandelshögskolan i göteborg/i, /\bhandelshögskolan vid göteborgs/i, /\bmedicinska fakulteten.*göteborgs/i, /\bfakulteten.*göteborgs universitet/i, /\bnationella sekretariatet för genusforskning/i],
  'Stockholms universitet': [/\bstockholms universitet/i],
  'KTH': [/\bkth\b/i, /\bkungliga tekniska högskolan/i],
  'Chalmers': [/\bchalmers tekniska högskola/i, /\bchalmers industriteknik/i, /\bchalmers cva\b/i],
  'Karolinska Institutet': [/\bkarolinska institutet/i, /\bkarolinska universitetssjukhuset/i, /\bkarolinska comprehensive/i, /\bkarolinska ccc\b/i, /\bprecisionsmedicinskt centrum karolinska/i],
  'Linköpings universitet': [/\blinköpings universitet/i, /\bbarnafrid vid linköpings/i, /\btema teknik.*linköpings/i],
  'Umeå universitet': [/\bumeå universitet/i],
  'Karlstads universitet': [/\bkarlstads? universitet/i, /\bcentrum för tjänsteforskning vid karlstads/i],
  'Luleå tekniska universitet': [/\bluleå tekniska universitet/i, /\bltu business\b/i],
  'Mittuniversitetet': [/^mittuniversitetet$/i],
  'Linnéuniversitetet': [/^linnéuniversitetet$/i],
  'Malmö universitet': [/\bmalmö universitet/i],
  'Mälardalens universitet': [/\bmälardalens universitet/i],
  'Södertörns högskola': [/\bsödertörns högskola/i],
  'Försvarshögskolan': [/^försvarshögskolan$/i],
  'Handelshögskolan i Stockholm': [/\bhandelshögskolan i stockholm/i],
  'Jönköping University': [/\bjönköping university/i, /\bhögskolan i jönköping/i],
  'Högskolan i Borås': [/\bhögskolan i borås/i, /\bscience park borås/i, /\btextile & fashion 2030/i],
  'Högskolan i Halmstad': [/\bhögskolan i halmstad/i],
  'Högskolan i Kristianstad': [/\bhögskolan i kristianstad/i],
  'Högskolan i Skövde': [/\bhögskolan i skövde/i],
  'Högskolan Dalarna': [/\bhögskolan dalarna/i],
  'Högskolan Väst': [/\bhögskolan väst/i],
  'Sveriges lantbruksuniversitet': [/\bsveriges lantbruksuniversitet/i, /\bslu future food\b/i, /\bslu campus\b/i],
};
const UNI_EXCLUDE = [/studentkår/i, /studentkårer/i, /\bventures\b/i];

function matchUniversity(name) {
  const lower = name.toLowerCase();
  if (UNI_EXCLUDE.some(e => e.test(lower))) return null;
  for (const [canonical, patterns] of Object.entries(UNIVERSITIES)) {
    if (name === canonical) return null; // already canonical
    if (patterns.some(p => p.test(lower))) return canonical;
  }
  return null;
}

// ============================================================
// Paginated Supabase fetch
// ============================================================
async function fetchAll(table, columns, filter) {
  const rows = [];
  let from = 0;
  while (true) {
    let q = supabase.from(table).select(columns).range(from, from + 999);
    if (filter) q = filter(q);
    const { data } = await q;
    rows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ============================================================
// STEP 2: Classify with Sonnet + context
// ============================================================
const SYSTEM_PROMPT = `Du klassificerar svenska organisationer efter sektor och undersektor.
Du får namn, antal events, vanligaste ämnen och aktiva år som kontext.

10 SEKTORER (välj exakt en):

1. näringsliv — privata företag som säljer produkter/tjänster
   Sub: bank_finans, försäkring, industri_tillverkning, handel, tech_it, fastighet, energi, transport, läkemedel_life_science, bygg_infrastruktur, livsmedel_jordbruk, övrigt_näringsliv

2. konsult_pr — konsultfirmor, PR-byråer, advokatbyråer, eventarrangörer, analysföretag
   Sub: konsult, pr_kommunikation, advokatbyrå, eventbyrå, rekrytering, analys_research
   Exempel: Herr Omar, EY, PwC, Sweco, Business Arena, Coreco, Kantar Public

3. arbetsgivar_branschorg — arbetsgivarorganisationer och branschföreningar för näringslivet
   Sub: arbetsgivarorganisation, branschförening
   Exempel: Almega, Svenskt Näringsliv, Teknikföretagen, Lif, IKEM, Svensk Handel, Sparbankernas Riksförbund

4. fackförbund — fackliga organisationer
   Sub: lo_förbund, tco_förbund, saco_förbund, annat_fack

5. civilsamhälle — folkrörelser, NGOs, ideella föreningar, lobbygrupper, patientorganisationer
   Sub: folkrörelse_ideell, välgörenhet_ngo, patientorg, lobbygrupp_kampanj, studieförbund, trossamfund
   Exempel: Rädda Barnen, RFSL, Röda Korset, Studieförbundet Bilda, Equmeniakyrkan, Kontantupproret

6. tänketank_stiftelse — tankesmedjor, stiftelser, forskningsfonder
   Sub: tänketank, stiftelse_fond
   Exempel: Timbro, Arena Idé, Fores, Futurion, Stiftelsen Tryggare Sverige, Humtank

7. offentlig_sektor — myndigheter, kommuner, regioner, riksdag, EU
   Sub: statlig_myndighet, region, kommun, riksdag_regering, eu_internationell
   Exempel: Business Sweden, Vinnova, Region Gotland, MUCF, EU-kommissionen

8. parti — politiska partier
   Sub: riksdagsparti, lokalt_parti, ungdomsförbund

9. media — tidningar, TV, branschmedia, digital media
   Sub: dagstidning, public_service, branschmedia, digital_media
   Exempel: Dagens industri, Expressen, SVT, Aktuell Hållbarhet, Dagens Medicin Agenda, Fastighetsvärlden, Spelalmedalen

10. akademi — universitet, högskolor, forskningsinstitut
    Sub: universitet_högskola, forskningsinstitut
    Exempel: Uppsala universitet, RISE, IVL, FOI, Totalförsvarets forskningsinstitut

REGLER:
- Eventarrangörer (Business Arena, Arena Energi, Stiftelsen Byggekologi om de arrangerar events) → media/branschmedia ELLER konsult_pr/eventbyrå
- Personnamn (Daniel Giertz, Sofia Nordgren) → konsult_pr/konsult
- "Svefa", "Demoskop", "Kairos Future" → konsult_pr/analys_research
- Forskningsprogram/centra KAN vara forskningsinstitut men INTE om de tydligt tillhör ett universitet
- Svara ENBART med JSON-array
- Varje objekt: {"id": <nummer>, "sector": "...", "sub_sector": "...", "confidence": 0.0-1.0}
- sector och sub_sector MÅSTE vara från listan ovan, annars räknas det som fel`;

async function classifyBatch(items) {
  const input = items.map(a => ({
    id: a.id,
    name: a.name,
    events: a.event_count,
    topics: a.top_topics,
    years: a.years,
  }));

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Klassificera:\n${JSON.stringify(input, null, 1)}` }],
  });

  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON: ' + text.substring(0, 200));
  const results = JSON.parse(match[0]);

  // Validate
  const validated = [];
  for (const r of results) {
    if (isValidClassification(r.sector, r.sub_sector)) {
      validated.push(r);
    } else {
      console.error(`\n  INVALID: id=${r.id} sector=${r.sector} sub=${r.sub_sector}`);
    }
  }
  return validated;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const mode = process.argv[2] || 'test'; // 'test' or 'full'

  console.log('=== Step 1: University merges ===');
  const arrangers = await fetchAll('arrangers', 'id, name');
  const merges = [];
  for (const a of arrangers) {
    const target = matchUniversity(a.name);
    if (target) merges.push({ from_id: a.id, from_name: a.name, to: target });
  }
  console.log(`${merges.length} university sub-units will be merged.`);
  if (mode === 'test') {
    merges.forEach(m => console.log(`  ${m.from_name}  →  ${m.to}`));
  }

  // Apply merges: update event_arrangers to point to canonical university
  if (mode === 'full') {
    for (const m of merges) {
      const canonical = arrangers.find(a => a.name === m.to);
      if (!canonical) continue;

      // Update all event_arrangers links from old to new
      // First get existing links
      const { data: links } = await supabase
        .from('event_arrangers')
        .select('event_id')
        .eq('arranger_id', m.from_id);

      if (links?.length) {
        for (const link of links) {
          // Try to insert new link, ignore if duplicate
          await supabase
            .from('event_arrangers')
            .upsert({ event_id: link.event_id, arranger_id: canonical.id, is_primary: false },
              { onConflict: 'event_id,arranger_id', ignoreDuplicates: true });
        }
        // Delete old links
        await supabase.from('event_arrangers').delete().eq('arranger_id', m.from_id);
      }
      // Delete old arranger
      await supabase.from('arranger_classifications').delete().eq('arranger_id', m.from_id);
      await supabase.from('arrangers').delete().eq('id', m.from_id);
    }
    const { count } = await supabase.from('arrangers').select('*', { count: 'exact', head: true });
    console.log(`Arrangers after merge: ${count}`);
  }

  console.log('\n=== Step 2: Classify with Sonnet + context ===');

  // Get event context for each arranger
  const allLinks = await fetchAll('event_arrangers', 'arranger_id, event_id');
  const allEvents = await fetchAll('events', 'id, topic_pdf_original, year');
  const eventMap = new Map(allEvents.map(e => [e.id, e]));

  // Build context per arranger
  const arrangerContext = new Map();
  for (const link of allLinks) {
    if (!arrangerContext.has(link.arranger_id)) {
      arrangerContext.set(link.arranger_id, { events: 0, topics: {}, years: new Set() });
    }
    const ctx = arrangerContext.get(link.arranger_id);
    ctx.events++;
    const event = eventMap.get(link.event_id);
    if (event) {
      if (event.topic_pdf_original) {
        ctx.topics[event.topic_pdf_original] = (ctx.topics[event.topic_pdf_original] || 0) + 1;
      }
      ctx.years.add(event.year);
    }
  }

  // Prepare arranger list with context
  const currentArrangers = mode === 'full'
    ? await fetchAll('arrangers', 'id, name')
    : arrangers; // use pre-merge list for test

  const enriched = currentArrangers
    .filter(a => !merges.some(m => m.from_id === a.id)) // exclude merged
    .map(a => {
      const ctx = arrangerContext.get(a.id) || { events: 0, topics: {}, years: new Set() };
      const topTopics = Object.entries(ctx.topics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t)
        .join(', ');
      return {
        id: a.id,
        name: a.name,
        event_count: ctx.events,
        top_topics: topTopics || '(okänt)',
        years: [...ctx.years].sort().join(',') || '(okänt)',
      };
    })
    .sort((a, b) => b.event_count - a.event_count);

  if (mode === 'test') {
    // TEST: Only classify top 100
    const testBatch = enriched.slice(0, 100);
    console.log(`\nClassifying top ${testBatch.length} arrangers (TEST MODE)...\n`);

    let allResults = [];
    for (let i = 0; i < testBatch.length; i += BATCH_SIZE) {
      const batch = testBatch.slice(i, i + BATCH_SIZE);
      process.stdout.write(`  ${Math.min(i + BATCH_SIZE, testBatch.length)}/${testBatch.length}\n`);
      const results = await classifyBatch(batch);
      allResults.push(...results);
    }

    // Print results for review
    console.log('\n=== TEST RESULTS (top 100) ===');
    console.log('Events  Sector'.padEnd(50) + 'Sub-sector'.padEnd(25) + 'Name');
    console.log('-'.repeat(120));
    for (const r of allResults) {
      const a = testBatch.find(t => t.id === r.id);
      if (a) {
        console.log(
          a.event_count.toString().padStart(5) + '  ' +
          r.sector.padEnd(25) + r.sub_sector.padEnd(25) + a.name
        );
      }
    }

    // Spot checks
    console.log('\n=== SPOT CHECKS ===');
    const checks = [
      { name: 'Uppsala universitet', expected: 'akademi/universitet_högskola' },
      { name: 'Business Sweden', expected: 'offentlig_sektor/statlig_myndighet' },
      { name: 'Herr Omar', expected: 'konsult_pr/konsult' },
      { name: 'Aktuell Hållbarhet', expected: 'media/branschmedia' },
      { name: 'Timbro', expected: 'tänketank_stiftelse/tänketank' },
      { name: 'Rädda Barnen', expected: 'civilsamhälle/välgörenhet_ngo' },
      { name: 'Svefa', expected: 'konsult_pr/analys_research' },
      { name: 'Futurion', expected: 'tänketank_stiftelse/tänketank' },
      { name: 'Sparbankernas Riksförbund', expected: 'arbetsgivar_branschorg/branschförening' },
      { name: 'Arena Energi', expected: 'konsult_pr/eventbyrå' },
    ];

    let passed = 0;
    for (const check of checks) {
      const a = testBatch.find(t => t.name.toLowerCase().includes(check.name.toLowerCase()));
      if (!a) { console.log(`  SKIP  ${check.name} (not in top 100)`); continue; }
      const r = allResults.find(r => r.id === a.id);
      const actual = r ? `${r.sector}/${r.sub_sector}` : 'NOT CLASSIFIED';
      const ok = actual === check.expected;
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${check.name}: ${actual} ${ok ? '' : '(expected: ' + check.expected + ')'}`);
      if (ok) passed++;
    }
    console.log(`\n${passed}/${checks.length} spot checks passed.`);

    // Sector distribution
    const sectors = {};
    for (const r of allResults) sectors[r.sector] = (sectors[r.sector] || 0) + 1;
    console.log('\nSector distribution (top 100):');
    Object.entries(sectors).sort((a, b) => b[1] - a[1])
      .forEach(([s, c]) => console.log(`  ${c.toString().padStart(3)}  ${s}`));

  } else {
    // FULL MODE
    console.log(`\nClassifying all ${enriched.length} arrangers...\n`);

    let classified = 0;
    let errors = 0;

    for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
      const batch = enriched.slice(i, i + BATCH_SIZE);
      process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, enriched.length)}/${enriched.length}`);

      try {
        const results = await classifyBatch(batch);
        const upserts = results.map(r => ({
          arranger_id: r.id,
          sector: r.sector,
          sub_sector: r.sub_sector,
          confidence: r.confidence,
          method: 'sonnet_v2',
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

    console.log(`\nClassified ${classified} (${errors} errors).`);

    // Final stats
    const all = await fetchAll('arranger_classifications', 'sector, sub_sector');
    const sectors = {};
    for (const r of all) sectors[r.sector] = (sectors[r.sector] || 0) + 1;

    console.log('\n=== FINAL SECTOR DISTRIBUTION ===');
    Object.entries(sectors).sort((a, b) => b[1] - a[1])
      .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));

    // Validate no invalid combos
    let invalid = 0;
    for (const r of all) {
      if (!isValidClassification(r.sector, r.sub_sector)) {
        invalid++;
      }
    }
    console.log(`\nInvalid sector/sub_sector combos: ${invalid}`);

    const { count: ac } = await supabase.from('arrangers').select('*', { count: 'exact', head: true });
    const { count: lc } = await supabase.from('event_arrangers').select('*', { count: 'exact', head: true });
    console.log(`Arrangers: ${ac}`);
    console.log(`Event-arranger links: ${lc}`);
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 50;

const SYSTEM_PROMPT = `Du klassificerar svenska organisationers undersektor (sub_sector). Du får organisationens namn och redan bestämd sektor. Din uppgift är att sätta rätt sub_sector.

Undersektorer per sektor:

näringsliv:
- bank_finans (banker, kreditinstitut, fondbolag)
- försäkring (försäkringsbolag, pensionsbolag)
- industri_tillverkning (gruvbolag, stål, papper, tillverkning)
- handel (detaljhandel, grossist, e-handel)
- tech_it (IT-bolag, mjukvara, telecom, gaming)
- konsult (managementkonsulter, PR-byråer, revisionsbyråer, advokatbyråer)
- fastighet (fastighetsbolag, bostadsbolag, arkitektkontor)
- energi (el, gas, vind, sol, kärnkraft, laddning)
- transport (flyg, sjöfart, tåg, åkeri, fordonstillverkare)
- läkemedel_life_science (läkemedelsbolag, medtech, biotech)
- bygg_infrastruktur (byggbolag, anläggning, VA, avfall)
- arbetsgivar_branschorg (arbetsgivarorganisationer, branschföreningar inom näringslivet, t.ex. Almega, Svenskt Näringsliv, Teknikföretagen, Svensk Handel)
- livsmedel_jordbruk (livsmedelsproducenter, lantbruk, mejerier)
- övrigt_näringsliv (företag som inte passar i ovan)

civilsamhälle:
- folkrörelse_ideell (breda ideella föreningar, funktionsrättsorganisationer, ungdomsorganisationer, idrottsföreningar)
- välgörenhet_ngo (bistånd, humanitärt, internationellt utvecklingsarbete)
- tänketank (politiska och oberoende tankesmedjor)
- patientorg (patientföreningar, diagnosföreningar)
- studieförbund (ABF, Bilda, Sensus, Medborgarskolan etc.)
- trossamfund (kyrkor, samfund, religiösa organisationer)
- branschorg_ideell (branschföreningar som är ideella, inte arbetsgivarorg)
- lobbygrupp_kampanj (enfrågeorganisationer, kampanjgrupper, allianser)
- stiftelse_fond (stiftelser, forskningsfonder, välgörenhetsfonder)

offentlig_sektor:
- statlig_myndighet
- region
- kommun
- riksdag_regering
- eu_internationell

fackförbund:
- lo_förbund
- tco_förbund
- saco_förbund
- annat_fack

parti:
- riksdagsparti
- lokalt_parti
- ungdomsförbund

media:
- dagstidning
- public_service
- branschmedia
- digital_media

akademi:
- universitet_högskola
- forskningsinstitut
- think_tank

Regler:
- Om namn innehåller kommaseparerade organisationer, klassificera den FÖRSTA
- ICA-handlarnas Förbund, HSB, Sveriges Allmännytta = branschorg_ideell
- "Herr Omar, Sustain Change" = konsult
- Svara ENBART med JSON-array, ingen annan text
- Varje objekt: {"id": <nummer>, "sub_sector": "...", "confidence": 0.0-1.0}`;

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

async function classifyBatch(arrangers) {
  const input = arrangers.map(a => ({ id: a.arranger_id, name: a.name, sector: a.sector }));

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Klassificera sub_sector för dessa organisationer:\n${JSON.stringify(input)}`
    }],
  });

  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response: ' + text.substring(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  // Get all classifications + arranger names
  const cls = await fetchAll('arranger_classifications', 'arranger_id, sector, sub_sector');
  const arrangers = await fetchAll('arrangers', 'id, name');
  const nameMap = new Map(arrangers.map(a => [a.id, a.name]));

  // Only reclassify the big catch-all sub_sectors
  const needsRework = cls.filter(c =>
    (c.sector === 'näringsliv' && c.sub_sector === 'annat') ||
    (c.sector === 'civilsamhälle' && c.sub_sector === 'intresseorganisation')
  ).map(c => ({
    arranger_id: c.arranger_id,
    name: nameMap.get(c.arranger_id),
    sector: c.sector,
  }));

  console.log(`Reclassifying ${needsRework.length} arrangers (annat + intresseorganisation)...`);

  let classified = 0;
  let errors = 0;

  for (let i = 0; i < needsRework.length; i += BATCH_SIZE) {
    const batch = needsRework.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, needsRework.length)}/${needsRework.length}`);

    try {
      const results = await classifyBatch(batch);

      const upserts = results.map(r => {
        const existing = cls.find(c => c.arranger_id === r.id);
        return {
          arranger_id: r.id,
          sector: existing?.sector || 'näringsliv',
          sub_sector: r.sub_sector,
          confidence: r.confidence,
          method: 'claude_v2',
        };
      });

      const { error } = await supabase
        .from('arranger_classifications')
        .upsert(upserts, { onConflict: 'arranger_id' });

      if (error) {
        console.error(`\nDB error at ${i}:`, error.message);
        errors++;
      } else {
        classified += results.length;
      }
    } catch (err) {
      console.error(`\nAPI error at ${i}:`, err.message?.substring(0, 100));
      errors++;
    }
  }

  console.log(`\nReclassified ${classified} arrangers (${errors} errors).`);

  // Final stats
  const all = await fetchAll('arranger_classifications', 'sector, sub_sector');

  for (const sector of ['näringsliv', 'civilsamhälle', 'offentlig_sektor', 'akademi', 'media', 'fackförbund', 'parti']) {
    const items = all.filter(c => c.sector === sector);
    if (items.length === 0) continue;
    const subs = {};
    for (const c of items) subs[c.sub_sector] = (subs[c.sub_sector] || 0) + 1;
    console.log(`\n${sector} (${items.length}):`);
    Object.entries(subs).sort((a, b) => b[1] - a[1])
      .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));
  }
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

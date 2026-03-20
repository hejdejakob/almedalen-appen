require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 50;

const SYSTEM_PROMPT = `Du klassificerar svenska organisationer efter sektor och undersektor.

Sektorer och undersektorer:

näringsliv:
- bank_finans, försäkring, industri_tillverkning, handel, tech_it, konsult, fastighet, energi, transport
- läkemedel_life_science, bygg_infrastruktur, livsmedel_jordbruk, övrigt_näringsliv

arbetsgivar_branschorg:
- arbetsgivarorganisation (Almega, Svenskt Näringsliv, Teknikföretagen)
- branschförening (Lif, IKEM, Svensk Handel, Dataspelsbranschen)

fackförbund:
- lo_förbund, tco_förbund, saco_förbund, annat_fack

civilsamhälle:
- folkrörelse_ideell, välgörenhet_ngo, tänketank, patientorg
- studieförbund, trossamfund, branschorg_ideell, lobbygrupp_kampanj, stiftelse_fond

offentlig_sektor:
- statlig_myndighet, region, kommun, riksdag_regering, eu_internationell

parti:
- riksdagsparti, lokalt_parti, ungdomsförbund

media:
- dagstidning, public_service, branschmedia, digital_media

akademi:
- universitet_högskola, forskningsinstitut, think_tank

Regler:
- PR-byråer, lobbybyråer, public affairs-firmor → näringsliv/konsult
- Arbetsgivarorganisationer och branschföreningar för näringslivet → arbetsgivar_branschorg
- Svara ENBART med JSON-array
- Varje objekt: {"id": <nummer>, "sector": "...", "sub_sector": "...", "confidence": 0.0-1.0}`;

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

async function classifyBatch(arrangers) {
  const input = arrangers.map(a => ({ id: a.id, name: a.name }));
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Klassificera:\n${JSON.stringify(input)}` }],
  });
  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON: ' + text.substring(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  const arrangers = await fetchAll('arrangers', 'id, name');
  console.log(`Classifying ${arrangers.length} arrangers...`);

  let classified = 0;
  let errors = 0;

  for (let i = 0; i < arrangers.length; i += BATCH_SIZE) {
    const batch = arrangers.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, arrangers.length)}/${arrangers.length}`);

    try {
      const results = await classifyBatch(batch);
      const upserts = results.map(r => ({
        arranger_id: r.id,
        sector: r.sector,
        sub_sector: r.sub_sector,
        confidence: r.confidence,
        method: 'claude',
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

  // Stats
  const all = await fetchAll('arranger_classifications', 'sector, sub_sector');
  const sectors = {};
  for (const r of all) sectors[r.sector] = (sectors[r.sector] || 0) + 1;

  console.log('\n=== Huvudsektorer ===');
  Object.entries(sectors).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));

  // Sub-sector details for big sectors
  for (const sector of ['näringsliv', 'civilsamhälle', 'arbetsgivar_branschorg']) {
    const items = all.filter(c => c.sector === sector);
    const subs = {};
    for (const c of items) subs[c.sub_sector] = (subs[c.sub_sector] || 0) + 1;
    console.log(`\n  ${sector}:`);
    Object.entries(subs).sort((a, b) => b[1] - a[1])
      .forEach(([s, c]) => console.log(`    ${c.toString().padStart(5)}  ${s}`));
  }
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });

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
- näringsliv: bank_finans, försäkring, industri_tillverkning, handel, tech_it, konsult, fastighet, energi, transport, annat
- fackförbund: lo_förbund, tco_förbund, saco_förbund, annat_fack
- civilsamhälle: intresseorganisation, välgörenhet_ngo, tänketank, patientorg, branschorg_ideell
- offentlig_sektor: statlig_myndighet, region, kommun, riksdag_regering, eu_internationell
- parti: riksdagsparti, lokalt_parti, ungdomsförbund
- media: dagstidning, public_service, branschmedia, digital_media
- akademi: universitet_högskola, forskningsinstitut, think_tank

Regler:
- Om namn innehåller kommaseparerade organisationer, klassificera den FÖRSTA
- Svara ENBART med JSON-array, ingen annan text
- Varje objekt: {"id": <nummer>, "sector": "...", "sub_sector": "...", "confidence": 0.0-1.0}
- Confidence 0.9+ = säker, 0.7-0.9 = ganska säker, <0.7 = osäker`;

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
  const input = arrangers.map(a => ({ id: a.id, name: a.name }));

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Klassificera dessa organisationer:\n${JSON.stringify(input)}`
    }],
  });

  const text = response.content[0].text;
  // Extract JSON array from response
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in response: ' + text.substring(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  // Get arrangers with low confidence
  const lowConf = await fetchAll('arranger_classifications', 'arranger_id',
    q => q.lt('confidence', 0.5));
  const ids = new Set(lowConf.map(r => r.arranger_id));

  const allArrangers = await fetchAll('arrangers', 'id, name');
  const needsReview = allArrangers.filter(a => ids.has(a.id));
  console.log(`Classifying ${needsReview.length} arrangers with Claude Haiku...`);

  let classified = 0;
  let errors = 0;

  for (let i = 0; i < needsReview.length; i += BATCH_SIZE) {
    const batch = needsReview.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, needsReview.length)}/${needsReview.length}`);

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

  console.log(`\nClassified ${classified} arrangers (${errors} errors).`);

  // Final stats
  const all = await fetchAll('arranger_classifications', 'sector, confidence, method');
  const sectors = {};
  let lowConfCount = 0;
  for (const r of all) {
    sectors[r.sector] = (sectors[r.sector] || 0) + 1;
    if (r.confidence < 0.5) lowConfCount++;
  }
  console.log('\n=== Final sektorfördelning ===');
  Object.entries(sectors).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));
  console.log(`\nLåg confidence (<0.5): ${lowConfCount}`);

  const methods = {};
  for (const r of all) methods[r.method] = (methods[r.method] || 0) + 1;
  console.log('Metoder:', methods);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const anthropic = new Anthropic();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE = 50;

const SYSTEM_PROMPT = `Du avgör om en svensk organisation är en arbetsgivarorganisation eller branschförening.

Du får organisationer som redan klassificerats som antingen:
- näringsliv/arbetsgivar_branschorg
- civilsamhälle/branschorg_ideell
- näringsliv/branschorg_ideell

Din uppgift: bestäm om organisationen ska ha:
1. sector: "arbetsgivar_branschorg", sub_sector: "arbetsgivarorganisation" — om de företräder arbetsgivare/företag (Almega, Svenskt Näringsliv, Teknikföretagen)
2. sector: "arbetsgivar_branschorg", sub_sector: "branschförening" — om de är branschförening för en specifik bransch (Lif, IKEM, Svensk Handel, Dataspelsbranschen, Sveriges Bussföretag)
3. sector: "civilsamhälle" — om de egentligen är ideella/civilsamhällesorganisationer (t.ex. ICA-handlarnas Förbund kan vara gränsfall)
4. sector: "näringsliv", sub_sector: "konsult" — om de egentligen är lobbybyråer/PR-firmor

Svara ENBART med JSON-array:
[{"id": <nummer>, "sector": "...", "sub_sector": "...", "confidence": 0.0-1.0}, ...]`;

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

async function classifyBatch(items) {
  const input = items.map(a => ({ id: a.arranger_id, name: a.name, current: a.sector + '/' + a.sub_sector }));

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Klassificera:\n${JSON.stringify(input)}`
    }],
  });

  const text = response.content[0].text;
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON: ' + text.substring(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  const cls = await fetchAll('arranger_classifications', 'arranger_id, sector, sub_sector');
  const arrangers = await fetchAll('arrangers', 'id, name');
  const nameMap = new Map(arrangers.map(a => [a.id, a.name]));

  // Find all branschorg candidates
  const candidates = cls.filter(c =>
    c.sub_sector === 'arbetsgivar_branschorg' ||
    c.sub_sector === 'branschorg_ideell'
  ).map(c => ({
    arranger_id: c.arranger_id,
    name: nameMap.get(c.arranger_id),
    sector: c.sector,
    sub_sector: c.sub_sector,
  }));

  console.log(`Reclassifying ${candidates.length} branschorg candidates...`);

  let classified = 0;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, candidates.length)}/${candidates.length}`);

    try {
      const results = await classifyBatch(batch);
      const upserts = results.map(r => ({
        arranger_id: r.id,
        sector: r.sector,
        sub_sector: r.sub_sector,
        confidence: r.confidence,
        method: 'claude_v3',
      }));

      const { error } = await supabase
        .from('arranger_classifications')
        .upsert(upserts, { onConflict: 'arranger_id' });

      if (error) console.error(`\nDB error:`, error.message);
      else classified += results.length;
    } catch (err) {
      console.error(`\nAPI error:`, err.message?.substring(0, 100));
    }
  }

  console.log(`\nReclassified ${classified}.`);

  // Final stats
  const all = await fetchAll('arranger_classifications', 'sector, sub_sector');
  const sectorCounts = {};
  for (const r of all) sectorCounts[r.sector] = (sectorCounts[r.sector] || 0) + 1;

  console.log('\n=== Huvudsektorer ===');
  Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));

  // Show sub_sectors for arbetsgivar_branschorg
  const ab = all.filter(c => c.sector === 'arbetsgivar_branschorg');
  const abSubs = {};
  for (const r of ab) abSubs[r.sub_sector] = (abSubs[r.sub_sector] || 0) + 1;
  console.log('\narbetsgivar_branschorg:');
  Object.entries(abSubs).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

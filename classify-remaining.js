require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function classify(name) {
  const p = name.split(',')[0].trim().toLowerCase();
  const full = name.toLowerCase();

  // === PARTI ===
  if (p.includes('socialdemokrater för') || p.includes('s-studenter'))
    return { sector: 'parti', sub_sector: 'riksdagsparti', confidence: 0.85 };
  if (p.includes('gröna studenter') || p.includes('gröna ungdom'))
    return { sector: 'parti', sub_sector: 'ungdomsförbund', confidence: 0.85 };
  if (p.includes('partiet mod'))
    return { sector: 'parti', sub_sector: 'lokalt_parti', confidence: 0.8 };
  if (/\b(niels paarup|riksdagsledamot|sara skyttedal)\b/.test(p))
    return { sector: 'parti', sub_sector: 'riksdagsparti', confidence: 0.7 };

  // === OFFENTLIG SEKTOR ===
  const govExact = [
    'business sweden', 'sgi', 'sgu', 'foi', 'icld', 'mucf', 'swedo',
    'systembolaget', 'kriminalvården', 'barnafrid', 'barnombudsmannen',
    'delegationen för unga', 'svenska esf-rådet', 'folkbildningsrådet',
    'konsumentverket', 'konjunkturinstitutet', 'kustbevakningen',
    'lantmäteriet', 'ungdomsstyrelsen', 'sida', 'si ', 'swedish institute',
    'svenska institutet', 'kulturförvaltningen', 'skr', 'interreg',
    'national contact point', 'gotlands trafikråd', 'region gotland',
    '2030-sekretariatet', 'viable cities', 'drive sweden',
    'forum för levande historia', 'unops', 'unhcr', 'fn:s',
  ];
  if (govExact.some(g => p.includes(g)))
    return { sector: 'offentlig_sektor', sub_sector: 'statlig_myndighet', confidence: 0.85 };

  if (p.includes('skr') || p.includes('sveriges kommuner och regioner'))
    return { sector: 'offentlig_sektor', sub_sector: 'kommun', confidence: 0.9 };

  // === AKADEMI ===
  if (p.includes('karolinska') || p.includes('kth') || p.includes('chalmers') ||
      p.includes('göteborgs universitet') || p.includes('linköpings universitet') ||
      p.includes('ai lund') || p.includes('agecap') || p.includes('gpcc') ||
      p.includes('humtank') || p.includes('berghs'))
    return { sector: 'akademi', sub_sector: 'universitet_högskola', confidence: 0.85 };

  if (p.includes('vetenskap & allmänhet') || p.includes('vetenskapsakademien'))
    return { sector: 'akademi', sub_sector: 'forskningsinstitut', confidence: 0.85 };

  // === FACKFÖRBUND ===
  if (p.includes('ledarna') || p.includes('sjukhusläkarna') || p.includes('tull-kust') ||
      p.includes('sjuksköterskor') || p.includes('arbetsterapeuter') ||
      p.includes('fysioterapeuterna') || p.includes('klys') ||
      p.includes('konstnärernas riksorganisation') || p.includes('skolkuratorer') ||
      p.includes('skolsköterskor') || p.includes('skolläkar') ||
      p.includes('psifos') || p.includes('läromedelsförfattarna') ||
      p.includes('union to union') || p.includes('lärarnas') ||
      p.includes('musikförläggarna') || p.includes('författarförbund') ||
      p.includes('tågföretagen') || p.includes('sveriges kommunikatörer') ||
      p.includes('annonsörer') || p.includes('sjukhusläkare'))
    return { sector: 'fackförbund', sub_sector: 'annat_fack', confidence: 0.8 };

  // === MEDIA ===
  if (p.includes('resumé') || p.includes('resume') || p.includes('femina') ||
      p.includes('tidskrifter') || p.includes('bokförlag') || p.includes('atlas') ||
      p.includes('news 55') || p.includes('senior') || p.includes('fastighetsvärlden') ||
      p.includes('second opinion') || p.includes('arbetsvärlden') ||
      p.includes('days of stockholm') || p.includes('tidningen dagen') ||
      p.includes('today'))
    return { sector: 'media', sub_sector: 'branschmedia', confidence: 0.75 };

  // === NÄRINGSLIV ===
  const companies = [
    'sweco', 'skanska', 'ncc', 'peab', 'veidekke', 'white arkitekter',
    'liljewall', 'wingårdhs', 'sandellsandberg',
    'lkab', 'ssab', 'h2 green steel', 'boliden',
    'telia', 'telenor', 'tele2', 'ericsson', 'tietoevry', 'cgi',
    'oracle', 'klarna', 'google', 'amazon', 'meta', 'samsung',
    'abb', 'siemens', 'wärtsilä', 'combitech',
    'arla', 'lantmännen', 'elgiganten', 'h&m',
    'sanofi', 'biogen', 'bristol myers', 'cytiva', 'novir',
    'roche', 'astrazeneca', 'pfizer', 'takeda', 'novo nordisk',
    'preem', 'circle k', 'okq8', 'st1', 'uniper',
    'volvo', 'scania', 'einride', 'heart aerospace',
    'riksbyggen', 'fabege', 'hemsö', 'obos', 'k2a', 'boklok', 'diös',
    'areim', 'brunswick real estate', 'magnolia bostad',
    'alecta', 'amf', 'skandia', 'wasa kredit', 'minpension',
    'ragn-sells', 'avfall sverige', 'urbaser',
    'apotek hjärtat', 'kronans apotek',
    'picadeli', 'hemnet', 'ellevio', 'tarkett',
    'consid', 'governo', 'ramboll', 'kairos future',
    'demoskop', 'kantar', 'statisticon',
    'ferroamp', 'recap energy', 'svea vind', 'solkompaniet',
    'globhe', 'smartroad', 'freja offshore',
    'atg ', 'agria', 'derome', 'feelgood', 'abilia',
    'visiba care', 'platform24', 'doktor24', 'medicheck',
    'swish', 'hui research', 'paf',
    'andreasson', 'narva communication', 'new republic',
    'strategisk arkitektur', 'juni strategi', 'codesign',
    'planör', 'granlund', 'trivector',
    'dynamic code', 'briab', 'larmtjänst', 'prodikt',
    'yacht & car', 'set up', 'verifiera', 'declara',
    'konfidence', 'confidence & victory', 'merry monday',
    'sobona', 'stuns', 'metacon', 'kvd', 'comfortzone',
    'pysslingen', 'academedia', 'magelungen',
    'herr omar', 'sustain change',
  ];
  if (companies.some(c => p.includes(c)))
    return { sector: 'näringsliv', sub_sector: 'annat', confidence: 0.75 };

  // Branschorganisationer
  const bransch = [
    'lif - de forskande', 'mäklarsamfundet', 'visita', 'almega',
    'mobility sweden', 'techsverige', 'tech-alliansen', 'ikem',
    'skgs', 'svemin', 'jernkontoret', 'dataspelsbransch',
    'säkerhets-och försvarsföretagen', 'soff', 'swecare',
    'hållbar e-handel', 'open source sweden', 'drivkraft sverige',
    'hagainitiativet', 'circular sweden', 'svensk handel',
    'mälardalsrådet', 'arlandaregionen', 'oslo-sthlm',
    'botniska korridoren', 'norrbotniabanegruppen', 'nya ostkustbanan',
    'vänersamarbetet', 'mobilitetsrådet', 'bussföretag',
    'gotlands lokalfinansiering', 'tillväxt gotland',
    'swelife', 'medtech4health', 'all.can',
    'american chamber', 'iq samhällsbyggnad',
    'siq ', 'ski svenskt', 'hbv',
    'förpackningsinsamlingen', 'näringslivets producent',
    'fti', 'energy efficiency', 'solelkommissionen',
    'electric garden', 'smart housing', 'träbyggnad', 'trästad',
  ];
  if (bransch.some(b => p.includes(b)))
    return { sector: 'näringsliv', sub_sector: 'annat', confidence: 0.75 };

  // === CIVILSAMHÄLLE ===
  const ngo = [
    'right to play', 'civil rights defenders', 'concord', 'oxfam',
    'erikshjälpen', 'maskrosbarn', 'fryshuset', 'mind,', 'mind ',
    'bris', 'rädda barnen', 'emmaus', 'unizon', 'roks',
    'jordens vänner', 'hiv-sverige', 'refugeehope',
    'world animal protection', 'djurskyddet', 'barnrättsorg',
    'we effect', 'fairtrade', 'fair action',
    'operation smile', 'läkarmissionen', 'pmu ', 'diakonia',
    'afrika', 'positiva pengar', 'acting for change',
    'ishr', 'rfsl', 'rfsu', 'transammans', 'lsu ',
    'stil - stiftarna', 'gapf', 'womenengage',
    'lex femme', 'proqvi', 'mantaray', 'unizon',
    'maktsalongen', 'tillsammans mot korruption',
    'växtbaserat', 'hållbart stockholm', 'lfm30',
    '100% förnybart', 'beautiful soup', 'a beautiful',
    'new kompisbyrån', 'ifmsa', 'sverok', 'spelalmedalen',
    'ung i fub', 'verdandi', 'can ', 'nsph', 'nadio',
    'psykologer mot tobak', 'tandvård mot tobak',
    'sjuksköterskor mot tobak', 'tobaksfakta',
    'balanskommissionen', 'motivationslyftet',
    'fremia', 'giva sverige', 'famna', 'civos', 'nod',
    'folkets hus', 'bosam', 'idéer för livet',
    'rtvd', 'branschrådet', 'kommissionen för skattenytta',
    'initiativ samutveckling', 'we are laja',
    'virus-och pandemifonden', 'utfallsfonden',
    'tailor-made responsibility', 'pathways coalition',
    'social venture network', 'svn ', 'impact hub',
    'bergsjön 2031', 'drömstudion', 'creartive',
    'östersjödagarna', 'hanaholmen',
    'ethos', 'junis', 'sekelporten', 'uniq',
    'lära för livet', 'upgrader',
    'folkhälsodalen', 'reform society',
    'aster', 'u&we', 'sweship',
    'stiftelsen leading health', 'futurion',
    'folk och försvar', 'försvarsutbildarna',
    'humanisterna', 'claphaminstitutet',
    'mindshift', 'välmåendepodden',
    'ekobanken', 'mikrofonden',
    'makalösa föräldrar', 'elevkår', 'elevernas',
    'kulturkvarteret', 'kulturskolerådet',
    '1 000 dagar', 'sensus',
    'european energy', 'arenaenergi',
    'polar capacity', 'aster', 'mistra',
    'arenan ', 'stadsutvecklingsdagarna',
    'arena för forskning',
    'mötesplats jönköpings',
    'east sweden',
    'svefa',
  ];
  if (ngo.some(n => p.includes(n)))
    return { sector: 'civilsamhälle', sub_sector: 'intresseorganisation', confidence: 0.7 };

  // Person names (likely speakers/consultants)
  if (/^[a-zåäö]+ [a-zåäö]+$/.test(p) && p.split(' ').length === 2)
    return { sector: 'näringsliv', sub_sector: 'konsult', confidence: 0.4 };

  // Remaining: default to civilsamhälle with low confidence
  return { sector: 'civilsamhälle', sub_sector: 'intresseorganisation', confidence: 0.4 };
}

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

async function main() {
  // Get arrangers with low confidence
  const lowConf = await fetchAll('arranger_classifications', 'arranger_id',
    q => q.lt('confidence', 0.5));
  const ids = new Set(lowConf.map(r => r.arranger_id));

  const allArrangers = await fetchAll('arrangers', 'id, name');
  const needsReview = allArrangers.filter(a => ids.has(a.id));
  console.log(`Classifying ${needsReview.length} arrangers...`);

  const results = [];
  let improved = 0;

  for (const a of needsReview) {
    const c = classify(a.name);
    results.push({
      arranger_id: a.id,
      sector: c.sector,
      sub_sector: c.sub_sector,
      confidence: c.confidence,
      method: c.confidence >= 0.5 ? 'rules_v2' : 'default_v2',
    });
    if (c.confidence >= 0.5) improved++;
  }

  console.log(`Improved: ${improved}/${needsReview.length}`);
  console.log(`Still low confidence: ${needsReview.length - improved}`);

  // Update DB
  const BATCH = 200;
  let updated = 0;
  for (let i = 0; i < results.length; i += BATCH) {
    const batch = results.slice(i, i + BATCH);
    const { error } = await supabase
      .from('arranger_classifications')
      .upsert(batch, { onConflict: 'arranger_id' });
    if (error) console.error('Error at', i, error.message);
    else updated += batch.length;
  }
  console.log(`Updated ${updated} in DB.`);

  // Final stats
  const all = await fetchAll('arranger_classifications', 'sector, confidence, method');
  const sectors = {};
  let stillLow = 0;
  for (const r of all) {
    sectors[r.sector] = (sectors[r.sector] || 0) + 1;
    if (r.confidence < 0.5) stillLow++;
  }
  console.log('\n=== Final sektorfördelning ===');
  Object.entries(sectors).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));
  console.log(`\nKvar med låg confidence: ${stillLow}`);

  const methods = {};
  for (const r of all) methods[r.method] = (methods[r.method] || 0) + 1;
  console.log('Metoder:', methods);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

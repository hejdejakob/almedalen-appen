require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rule-based classifier using keywords in arranger name
// Classify based on the FIRST organization if comma-separated
function classify(name) {
  // Get primary org (first in comma-separated list)
  const primary = name.split(',')[0].trim().toLowerCase();
  const full = name.toLowerCase();

  // --- PARTI ---
  const partiNames = [
    'socialdemokraterna', 'moderaterna', 'sverigedemokraterna', 'centerpartiet',
    'vänsterpartiet', 'kristdemokraterna', 'liberalerna', 'miljöpartiet',
    'feministiskt initiativ', 'piratpartiet', 'nyans', 'alternativ för sverige',
    'landsbygdspartiet', 'medborgerlig samling',
  ];
  if (partiNames.some(p => primary.includes(p)))
    return { sector: 'parti', sub_sector: 'riksdagsparti', confidence: 0.95 };

  if (primary.match(/\b(s|m|sd|c|v|kd|l|mp)\s*(ungdom|student)/i) ||
      primary.includes('ungdomsförbund') || primary.includes('ung vänster') ||
      primary.includes('ssa ') || primary.includes('muf ') ||
      primary.includes('centerpartiets ungdomsförbund') ||
      primary.includes('grön ungdom') || primary.includes('liberal ungdom'))
    return { sector: 'parti', sub_sector: 'ungdomsförbund', confidence: 0.9 };

  if (primary.includes('moderatkvinnorna') || primary.includes('s-kvinnor') ||
      primary.includes('centerkvinnorna'))
    return { sector: 'parti', sub_sector: 'riksdagsparti', confidence: 0.9 };

  // --- OFFENTLIG SEKTOR ---
  if (primary.match(/\bkommun\b/) || primary.match(/\bkommuns\b/) || primary.endsWith(' kommun') ||
      primary.includes('stads ') || primary.match(/\bstad\b/) ||
      primary.includes('göteborgs stad') || primary.includes('stockholms stad') ||
      primary.includes('malmö stad'))
    return { sector: 'offentlig_sektor', sub_sector: 'kommun', confidence: 0.95 };

  if (primary.includes('region ') || primary.match(/^region\b/) ||
      primary.includes('regionförbund') || primary.includes('landsting'))
    return { sector: 'offentlig_sektor', sub_sector: 'region', confidence: 0.95 };

  const myndigheter = [
    'myndighet', 'riksdag', 'regering', 'departement', 'statskontor',
    'försäkringskassan', 'arbetsförmedlingen', 'migrationsverket',
    'skatteverket', 'polismyndigheten', 'socialstyrelsen', 'skolverket',
    'naturvårdsverket', 'energimyndigheten', 'tillväxtverket',
    'trafikverket', 'transportstyrelsen', 'boverket', 'riksbanken',
    'riksrevisionen', 'riksantikvarieämbetet', 'länsstyrelse',
    'folkhälsomyndigheten', 'smhi', 'sida', 'vetenskapsrådet',
    'vinnova', 'forte', 'formas', 'riksarkivet', 'kulturrådet',
    'konstnärsnämnden', 'konstrådet', 'kungliga biblioteket',
    'inspektionen', 'ombudsman', 'datainspektionen', 'konkurrensverket',
    'konjunkturinstitutet', 'statskontoret', 'riksgälden',
    'krisinformation', 'msb', 'totalförsvaret', 'försvarsmakten',
    'havs- och vattenmyndigheten', 'jordbruksverket', 'livsmedelsverket',
    'patent- och registreringsverket', 'post- och telestyrelsen',
    'mucf', 'barnombudsmannen', 'do ', 'diskrimineringsombudsmannen',
    'kemikalieinspektionen', 'strålsäkerhetsmyndigheten',
  ];
  if (myndigheter.some(m => primary.includes(m)))
    return { sector: 'offentlig_sektor', sub_sector: 'statlig_myndighet', confidence: 0.9 };

  if (primary.includes('eu-kommission') || primary.includes('europakommission') ||
      primary.includes('europaparlament') || primary.includes('embassy') ||
      primary.includes('ambassad') || primary.includes('united nations') ||
      primary.includes('fn ') || primary.includes('unicef') ||
      primary.includes('nato ') || primary.includes('nordiska ministerrådet') ||
      primary.includes('nordiska rådet'))
    return { sector: 'offentlig_sektor', sub_sector: 'eu_internationell', confidence: 0.9 };

  // --- AKADEMI ---
  if (primary.includes('universitet') || primary.includes('högskola') ||
      primary.includes('university'))
    return { sector: 'akademi', sub_sector: 'universitet_högskola', confidence: 0.95 };

  if (primary.includes('forskningsinstitutet') || primary.includes('forskningsråd') ||
      primary.match(/\brise\b/) || primary.includes('ivl ') ||
      primary.includes('institutet för') || primary.includes('karolinska'))
    return { sector: 'akademi', sub_sector: 'forskningsinstitut', confidence: 0.85 };

  // --- FACKFÖRBUND ---
  const loForbund = [
    'if metall', 'kommunal', 'handels', 'byggnads', 'transport ',
    'elektrikerna', 'fastighets', 'hotell- och restaurangfacket',
    'livs', 'pappers', 'seko ', 'målarna', 'musikerförbundet',
    'gs-facket',
  ];
  if (loForbund.some(f => primary.includes(f)) || primary === 'lo' || primary === 'landsorganisationen')
    return { sector: 'fackförbund', sub_sector: 'lo_förbund', confidence: 0.9 };

  const tcoForbund = [
    'unionen', 'vårdförbundet', 'lärarförbundet', 'vision ',
    'journalistförbundet', 'fackförbundet st', 'finansförbundet',
    'försvarsförbundet', 'polisförbundet', 'teaterförbundet',
    'tjänstemanna', 'tco',
  ];
  if (tcoForbund.some(f => primary.includes(f)))
    return { sector: 'fackförbund', sub_sector: 'tco_förbund', confidence: 0.9 };

  const sacoForbund = [
    'läkarförbundet', 'ingenjörer', 'akademiker', 'jusek',
    'naturvetarna', 'civilekonomerna', 'dik ', 'farmacevt',
    'psykologförbundet', 'veterinärförbundet', 'officersförbundet',
    'saco', 'lärarnas riksförbund',
  ];
  if (sacoForbund.some(f => primary.includes(f)))
    return { sector: 'fackförbund', sub_sector: 'saco_förbund', confidence: 0.9 };

  if (primary.includes('fack') || primary.includes('lo-tco') ||
      primary.includes('arbetarrörelse'))
    return { sector: 'fackförbund', sub_sector: 'annat_fack', confidence: 0.8 };

  // --- MEDIA ---
  const media = [
    'dagens industri', 'di ', 'svd', 'svenska dagbladet', 'dn',
    'dagens nyheter', 'aftonbladet', 'expressen', 'gp ',
    'göteborgs-posten', 'sydsvenskan', 'tt ',
  ];
  if (media.some(m => primary.includes(m)) || primary.includes('dagblad'))
    return { sector: 'media', sub_sector: 'dagstidning', confidence: 0.85 };

  if (primary.includes('svt') || primary.includes('sr ') ||
      primary.includes('sveriges radio') || primary.includes('sveriges television') ||
      primary.includes('ur ') || primary.includes('utbildningsradion'))
    return { sector: 'media', sub_sector: 'public_service', confidence: 0.95 };

  const branschmedia = [
    'dagens medicin', 'aktuell hållbarhet', 'altinget',
    'tidningen', 'nyhetsmagasinet', 'agenda', 'mediagruppen',
    'resume ', 'journalisten', 'offentliga affärer',
    'di mobilitet', 'chef ', 'medievärlden',
  ];
  if (branschmedia.some(m => primary.includes(m)))
    return { sector: 'media', sub_sector: 'branschmedia', confidence: 0.8 };

  if (primary.includes('tidningsutgivarna') || primary.includes('medieföretagen'))
    return { sector: 'media', sub_sector: 'branschmedia', confidence: 0.85 };

  // --- NÄRINGSLIV ---
  if (primary.includes('bank') || primary.includes('seb') || primary.includes('swedbank') ||
      primary.includes('handelsbanken') || primary.includes('nordea') ||
      primary.includes('kommuninvest') || primary.includes('sparbank'))
    return { sector: 'näringsliv', sub_sector: 'bank_finans', confidence: 0.9 };

  if (primary.includes('försäkring') || primary.includes('skandia') ||
      primary.includes('folksam') || primary.includes('trygg-hansa') ||
      primary.includes('if skadeförsäkring') || primary.includes('afa '))
    return { sector: 'näringsliv', sub_sector: 'försäkring', confidence: 0.9 };

  if (primary.includes('energi') || primary.includes('e.on') || primary.includes('vattenfall') ||
      primary.includes('fortum') || primary.includes('vätgas'))
    return { sector: 'näringsliv', sub_sector: 'energi', confidence: 0.85 };

  if (primary.includes('fastighet') || primary.includes('bostads') ||
      primary.includes('hyresbostäder') || primary.includes('sveafastigheter'))
    return { sector: 'näringsliv', sub_sector: 'fastighet', confidence: 0.85 };

  if (primary.includes('transport') || primary.includes('volvo') ||
      primary.includes('scania') || primary.includes('sjöfart'))
    return { sector: 'näringsliv', sub_sector: 'transport', confidence: 0.85 };

  if (primary.includes('ericsson') || primary.includes('telia') ||
      primary.includes('microsoft') || primary.includes('google') ||
      primary.includes('ibm') || primary.includes('cisco'))
    return { sector: 'näringsliv', sub_sector: 'tech_it', confidence: 0.9 };

  if (primary.includes('konsult') || primary.includes('ey') ||
      primary.includes('pwc') || primary.includes('deloitte') ||
      primary.includes('kpmg') || primary.includes('mckinsey') ||
      primary.includes('bcg ') || primary.includes('accenture'))
    return { sector: 'näringsliv', sub_sector: 'konsult', confidence: 0.85 };

  if (primary.match(/\bab\b/) || primary.includes(' ab,') || primary.endsWith(' ab') ||
      primary.includes('group') || primary.includes('inc') || primary.includes('ltd') ||
      primary.includes('holding') || primary.includes('corp'))
    return { sector: 'näringsliv', sub_sector: 'annat', confidence: 0.7 };

  // --- CIVILSAMHÄLLE ---
  if (primary.includes('röda korset') || primary.includes('rädda barnen') ||
      primary.includes('amnesty') || primary.includes('wwf') ||
      primary.includes('greenpeace') || primary.includes('diakonia') ||
      primary.includes('läkare utan gränser') || primary.includes('plan international') ||
      primary.includes('oxfam') || primary.includes('frälsningsarmén') ||
      primary.includes('stadsmission') || primary.includes('war child') ||
      primary.includes('hand in hand') || primary.includes('ecpat'))
    return { sector: 'civilsamhälle', sub_sector: 'välgörenhet_ngo', confidence: 0.95 };

  if (primary.includes('timbro') || primary.includes('arena idé') ||
      primary.includes('fores') || primary.includes('tankesmedj') ||
      primary.includes('cogito') || primary.includes('katalys') ||
      primary.includes('global utmaning'))
    return { sector: 'civilsamhälle', sub_sector: 'tänketank', confidence: 0.9 };

  if (primary.includes('patientförening') || primary.includes('cancerfond') ||
      primary.includes('hjärt-lungfonden') || primary.includes('astma') ||
      primary.includes('diabetesförbundet') || primary.includes('reumatikerförbundet') ||
      primary.includes('psoriasisförbundet') || primary.includes('riksförbundet attention'))
    return { sector: 'civilsamhälle', sub_sector: 'patientorg', confidence: 0.9 };

  if (primary.includes('bransch') && primary.includes('förening'))
    return { sector: 'civilsamhälle', sub_sector: 'branschorg_ideell', confidence: 0.8 };

  // Broad civil society patterns
  if (primary.includes('förening') || primary.includes('förbund') ||
      primary.includes('riksförbund') || primary.includes('sällskap') ||
      primary.includes('stiftelse') || primary.includes('foundation') ||
      primary.includes('ideell') || primary.includes('nätverket') ||
      primary.includes('rörelsen') || primary.includes('kommittén'))
    return { sector: 'civilsamhälle', sub_sector: 'intresseorganisation', confidence: 0.75 };

  // Employer/industry orgs
  if (primary.includes('arbetsgivare') || primary.includes('företagarna') ||
      primary.includes('almega') || primary.includes('svenskt näringsliv') ||
      primary.includes('handelskammar') || primary.includes('svensk handel') ||
      primary.includes('teknikföretagen') || primary.includes('jernkontoret') ||
      primary.includes('installat') || primary.includes('energiföretagen') ||
      primary.includes('transportföretagen') || primary.includes('livsmedelsföretagen'))
    return { sector: 'näringsliv', sub_sector: 'annat', confidence: 0.8 };

  // Pharma / healthcare companies
  if (primary.includes('pharma') || primary.includes('roche') ||
      primary.includes('novartis') || primary.includes('astrazeneca') ||
      primary.includes('novo nordisk') || primary.includes('janssen') ||
      primary.includes('takeda') || primary.includes('pfizer'))
    return { sector: 'näringsliv', sub_sector: 'annat', confidence: 0.85 };

  // Church / religious org
  if (primary.includes('kyrkan') || primary.includes('kyrka') ||
      primary.includes('islamic') || primary.includes('kristen'))
    return { sector: 'civilsamhälle', sub_sector: 'intresseorganisation', confidence: 0.7 };

  // Fallback: unknown
  return { sector: 'övrigt', sub_sector: 'övrigt', confidence: 0.3 };
}

// Paginated fetch
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

async function main() {
  console.log('Fetching arrangers...');
  const arrangers = await fetchAll('arrangers', 'id, name');
  console.log(`Got ${arrangers.length} arrangers.`);

  const classifications = arrangers.map(a => {
    const { sector, sub_sector, confidence } = classify(a.name);
    return {
      arranger_id: a.id,
      sector,
      sub_sector,
      confidence,
      method: 'rules',
    };
  });

  // Stats
  const sectorCounts = {};
  let lowConfidence = 0;
  for (const c of classifications) {
    sectorCounts[c.sector] = (sectorCounts[c.sector] || 0) + 1;
    if (c.confidence < 0.5) lowConfidence++;
  }

  console.log('\n=== Sektorfördelning ===');
  Object.entries(sectorCounts).sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => console.log(`  ${c.toString().padStart(5)}  ${s}`));
  console.log(`\nLåg confidence (<0.5): ${lowConfidence} (behöver granskning)`);

  // Insert into DB
  console.log('\nInserting classifications...');
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < classifications.length; i += BATCH) {
    const batch = classifications.slice(i, i + BATCH);
    process.stdout.write(`\r  ${Math.min(i + BATCH, classifications.length)}/${classifications.length}`);

    const { error } = await supabase
      .from('arranger_classifications')
      .upsert(batch, { onConflict: 'arranger_id' });

    if (error) {
      console.error(`\nBatch error at ${i}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`\nInserted ${inserted} classifications.`);

  // Save low-confidence for review
  const flagged = classifications
    .filter(c => c.confidence < 0.5)
    .map(c => {
      const a = arrangers.find(a => a.id === c.arranger_id);
      return { id: c.arranger_id, name: a?.name, sector: c.sector, confidence: c.confidence };
    });

  fs.writeFileSync('/tmp/flagged-arrangers.json', JSON.stringify(flagged, null, 2));
  console.log(`Saved ${flagged.length} flagged arrangers to /tmp/flagged-arrangers.json`);
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});

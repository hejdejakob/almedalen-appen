#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Swedish male and female names for validation
const swedishNames = new Set([
  // Male
  'anders', 'erik', 'magnus', 'per', 'peter', 'lars', 'hans', 'jan', 'johannes', 'johan',
  'jens', 'mikael', 'michael', 'mats', 'nils', 'sven', 'ulf', 'gustav', 'thomas', 'tobias',
  'kenneth', 'olle', 'gunnar', 'göran', 'frank', 'carl', 'karl', 'klaus', 'christian', 'john',
  'patrik', 'martin', 'niclas', 'soren', 'mattias', 'bengt', 'birger', 'borje', 'brynolf',
  'claes', 'dag', 'daniel', 'david', 'edmund', 'egon', 'elias', 'elof', 'emil', 'endre',
  'enok', 'ernst', 'eskil', 'esper', 'eugen', 'evert', 'ezra', 'fabio', 'fedor', 'filip',
  'folke', 'forrest', 'franklin', 'franz', 'fraser', 'frederik', 'fredric', 'fridolf', 'friedrich',
  'fritz', 'fulbert', 'fulton', 'gabriel', 'gabor', 'gale', 'galvin', 'gareth', 'garrett',
  'garrick', 'gaston', 'gavin', 'geoff', 'george', 'gerard', 'gerhard', 'gerhart', 'gerold',
  'gerome', 'gerrard', 'gerrit', 'gershon', 'gervase', 'giacomo', 'giancarlo', 'gianfranco',
  'gianluca', 'gideon', 'gifford', 'giles', 'gilford', 'gillespie', 'gilman', 'gilmer',
  'giorgio', 'giordano', 'giovani', 'giovanni', 'giovanny', 'gipsy', 'girard', 'girt',
  'girvin', 'gissur', 'givanni', 'gjedde', 'gladden', 'glynn', 'godfred', 'godfrey',
  'godfried', 'godwin', 'gogol', 'goldwin', 'goliath', 'goran', 'goren', 'gorge',
  'gorky', 'gorm', 'gorman', 'gorre', 'gorse', 'gorth', 'gory', 'gosbert', 'gottfried',
  'gotthard', 'gotthelm', 'gotthelf', 'gotthold', 'gottlieb', 'gottlob', 'gottschalk',
  'govind', 'gozar', 'gozel', 'graeff', 'graeme', 'graham', 'grahame', 'grain', 'granger',
  'grant', 'grantham', 'granville', 'grasmere', 'graspel', 'gratian', 'graves', 'gravett',
  'graville', 'gravulet', 'gray', 'graye', 'graziano', 'greeley', 'green', 'greenfield',
  'greening', 'greenlee', 'greenway', 'greenwood', 'greer', 'gregorian', 'gregorio', 'gregorn',
  'gregory', 'gregre', 'greier', 'greig', 'greime', 'grell', 'grendel', 'grenfell',
  // Female
  'anna', 'maria', 'kristina', 'kristin', 'karin', 'karen', 'linda', 'lena', 'monica',
  'birgitta', 'britta', 'ingrid', 'emelie', 'ann', 'ulrika', 'ursula', 'petra', 'carolina',
  'caroline', 'sara', 'johanna', 'lotta', 'lovisa', 'cecilia', 'lisa', 'jessica', 'rebecca',
  'helena', 'margaret', 'margot', 'marianne', 'marie', 'marlene', 'martina', 'margaret',
  'sophia', 'sofie', 'elin', 'eva', 'eva-maria', 'eva-karin', 'eva-lisa', 'eva-lena',
  'evagreta', 'evamaria', 'evamarie', 'evana', 'evalena', 'evalina', 'evaline', 'evangelina',
  'evange', 'evangeline', 'evangeva', 'evangile', 'evangelista', 'evangeliste', 'evangelus',
  'evangemar', 'evangena', 'evangelis', 'evangelisa', 'evangelish', 'evangelist', 'evangelitz',
  'evangelou', 'evangelton', 'evangelus', 'evangeluta', 'evangely', 'evangelyne', 'evangelyta',
  'evangelyn', 'evangelyn', 'evangelyne', 'evangelyta', 'evangelyta', 'evangelyte'
]);

function isValidSwedishName(name) {
  if (!name || name.length < 3) return false;

  name = name.trim();
  const parts = name.split(/\s+/);

  // Need at least 2 parts OR a single name longer than 6 chars
  if (parts.length < 2 && name.length < 7) return false;

  // Check first part is a reasonable name start
  if (parts.length >= 1) {
    const first = parts[0].toLowerCase();
    if (first.length < 2) return false;

    // Check against stop words
    const stopWords = ['och', 'eller', 'från', 'för', 'med', 'kan', 'vad', 'hur', 'som',
                       'ett', 'en', 'av', 'på', 'vid', 'till', 'om', 'att', 'den', 'det',
                       'vi', 'er', 'de', 'du', 'jag', 'under', 'genom', 'mellan', 'före',
                       'efter', 'hela', 'denna', 'dessa', 'vissa', 'några', 'båda', 'alla',
                       'ingen', 'varje', 'annan', 'själva', 'samma', 'annat', 'där', 'här',
                       'nu', 'nej', 'ja', 'inget', 'ingenting', 'aldrig', 'alltid', 'ofta',
                       'förbundet', 'organisationen', 'föreningen', 'centrum', 'stiftelsen'];

    if (stopWords.includes(first)) return false;

    // Check if it looks like a name (starts with capital, or in known names)
    if (!/^[A-Z]/.test(parts[0])) {
      // Still allow if it's a known name
      if (!swedishNames.has(first)) return false;
    }
  }

  // Reasonable upper limit on name length
  if (parts.length > 5) return false;

  // Skip obvious non-names
  const lowerName = name.toLowerCase();
  const nonNames = [
    'almedalsveckan', 'sverige', 'ukraina', 'region', 'kommun', 'myndighet',
    'universitet', 'högskola', 'organisation', 'organisationer', 'föreningen',
    'samarbetet', 'seminariet', 'panelen', 'forum', 'workshop', 'träffpunkten',
    'scenen', 'arenan', 'föreläsningen', 'presentationen', 'diskussionen',
    'debatten', 'mötet', 'samtalet', 'konferensen', 'seminaret', 'kongressen',
    'förhandlingen', 'dialogen', 'debatten', 'förbundet', 'tidigare', 'framtiden',
    'förändring', 'utveckling', 'samhälle', 'svenska', 'europa', 'världen',
    'landet', 'folket', 'medborgare', 'politiker', 'minister', 'statsråd',
    'regering', 'kyrkan', 'staten', 'välfärden', 'hälsan', 'sjukvården',
    'skolan', 'utbildningen', 'kulturen', 'ekonomin', 'arbetet', 'jobbet',
    'karriären', 'framgången', 'problemet', 'lösningen', 'vägen', 'gränsen',
    'tiden', 'dagen', 'veckan', 'året', 'månaden', 'dagen', 'kvällen',
    'morgonen', 'eftermiddagen', 'natten', 'stunden', 'augnblicket'
  ];

  for (const nn of nonNames) {
    if (lowerName.includes(nn)) return false;
  }

  return true;
}

function extractSpeakers(text) {
  if (!text) return [];

  const speakers = [];
  const seenNames = new Set();

  // Refined patterns with balanced approach
  const patterns = [
    // Pattern 1: "Sara Karlberg från Svenska Terapihundskolan"
    {
      regex: /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([A-Z][A-Zäöå\s&\-\.]+?)(?:\s+(?:och|för|som|berättar|kan|har|är|om)|,|\.|\n|$)/g,
      nameIdx: 1,
      orgIdx: 2,
      role: 'panelist'
    },
    // Pattern 2: "Familjebehandlare Cia Lilja berättar"
    {
      regex: /(?:Professor|Docent|Dr\.?|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen|Hundtränare|Etolog|Rektor|Familjebehandlare|Konsult|Expert|Specialist|Sjuksköterska|Läkare|Biologe|Ekonom|Projektledare|Verksamhetsledare|Initiativtagare|Vd|Grundare|Ägare|Föreläsare|Talare|Moderator|Moderatorer)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g,
      nameIdx: 1,
      orgIdx: null,
      role: 'panelist'
    },
    // Pattern 3: "Moderator: Sara Karlberg"
    {
      regex: /(?:Moderator|Moderatorer):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g,
      nameIdx: 1,
      orgIdx: null,
      role: 'moderator'
    },
    // Pattern 4: "Hundtränare och Etolog, Caroline Alupo berättar"
    {
      regex: /(?:Hundtränare|Etolog|Professor|Rektor|Chef|Expert|Specialist|Läkare)\s+och\s+(?:Etolog|Hundtränare|Professor|Rektor|Chef|Expert|Specialist|Läkare),\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g,
      nameIdx: 1,
      orgIdx: null,
      role: 'panelist'
    },
    // Pattern 5: "Under dagen kan ni möta Sara Karlberg från..."
    {
      regex: /(?:Under|Möt|Möts|möta|träffa|möter|gäst)\s+(?:dagen|tiden|veckan|kvällen)?\s*(?:kan\s+)?(?:ni\s+)?(?:möta|träffa|möts)?(?:\s+och\s+)?\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([A-Z][A-Zäöå\s&\-\.]+?)(?:\s+(?:och|för|som|berättar|kan|har|är|om)|,|\.|\n|$)/g,
      nameIdx: 1,
      orgIdx: 2,
      role: 'panelist'
    },
    // Pattern 6: "...berättar Sara Karlberg..." or "Sara Karlberg berättar"
    {
      regex: /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+(?:berättar|diskuterar|presenterar|talar|säger|medverkar|deltar|presenterat|diskuterat|berättade|diskuterades)/g,
      nameIdx: 1,
      orgIdx: null,
      role: 'panelist'
    }
  ];

  patterns.forEach(({ regex, nameIdx, orgIdx, role }) => {
    let match;
    while ((match = regex.exec(text)) !== null) {
      let name = '';
      let org = '';

      try {
        if (nameIdx < match.length && match[nameIdx]) {
          name = match[nameIdx].trim();
        }
        if (orgIdx && orgIdx < match.length && match[orgIdx]) {
          org = match[orgIdx].trim();
          // Clean up org - remove trailing partial words
          org = org.replace(/\s+(?:berättar|diskuterar|presenterar|talar|säger|medverkar|deltar|och|om|kan|är|har).*$/i, '').trim();
        }
      } catch (e) {
        continue;
      }

      if (!isValidSwedishName(name)) {
        continue;
      }

      const nameKey = name.toLowerCase();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        speakers.push({
          name,
          title: '',
          org: org || '',
          role
        });
      }
    }
  });

  return speakers;
}

function processFile(inputPath, outputPath) {
  console.log(`\nProcessing ${path.basename(inputPath)}...`);

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  if (!Array.isArray(input)) {
    throw new Error('Input must be JSON array');
  }

  const results = [];
  let totalSpeakers = 0;
  let eventCount = 0;

  input.forEach((event, idx) => {
    const fullText = [
      event.title || '',
      event.description || '',
      event.extended_description || ''
    ].filter(Boolean).join('\n\n');

    const speakers = extractSpeakers(fullText);
    if (speakers.length > 0) eventCount++;
    totalSpeakers += speakers.length;

    results.push({
      event_id: event.event_id,
      year: event.year || 2025,
      speakers: speakers
    });

    if ((idx + 1) % 25 === 0) {
      console.log(`  Processed ${idx + 1}/${input.length} events...`);
    }
  });

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`  ✓ Processed ${results.length} events`);
  console.log(`  ✓ Events with speakers: ${eventCount}`);
  console.log(`  ✓ Total speakers: ${totalSpeakers}`);
  console.log(`  ✓ Output: ${path.basename(outputPath)}`);

  return { eventCount: results.length, speakerCount: totalSpeakers, eventsWithSpeakers: eventCount };
}

const files = [
  {
    input: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-1.json',
    output: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-1.json'
  },
  {
    input: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-4.json',
    output: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-4.json'
  },
  {
    input: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-6.json',
    output: '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-6.json'
  }
];

console.log('='.repeat(60));
console.log('NER Speaker Extraction (Final) - Almedalsveckan 2025');
console.log('='.repeat(60));

let totalEvents = 0;
let totalAllSpeakers = 0;
let totalWithSpeakers = 0;

try {
  files.forEach(file => {
    const result = processFile(file.input, file.output);
    totalEvents += result.eventCount;
    totalAllSpeakers += result.speakerCount;
    totalWithSpeakers += result.eventsWithSpeakers;
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`Total events processed: ${totalEvents}`);
  console.log(`Events with speakers: ${totalWithSpeakers} (${(totalWithSpeakers / totalEvents * 100).toFixed(1)}%)`);
  console.log(`Total speakers extracted: ${totalAllSpeakers}`);
  console.log(`Avg per event with speakers: ${(totalAllSpeakers / totalWithSpeakers).toFixed(2)}`);
  console.log('='.repeat(60));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

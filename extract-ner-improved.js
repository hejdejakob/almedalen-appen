#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common Swedish first names and parts to help validate names
const commonFirstNames = new Set([
  'anders', 'anna', 'erik', 'magnus', 'maria', 'per', 'peter', 'lars', 'hans', 'jan',
  'johannes', 'johan', 'jens', 'mikael', 'michael', 'mats', 'nils', 'sven', 'ulf',
  'gustav', 'kristina', 'kristin', 'karin', 'karen', 'linda', 'lena', 'monica',
  'birgitta', 'britta', 'ingrid', 'ingvar', 'ingemar', 'thomas', 'tobias', 'kenneth',
  'olle', 'gunnar', 'göran', 'göte', 'frank', 'carl', 'karl', 'klaus', 'cia', 'sara',
  'christian', 'john', 'johanna', 'lotta', 'lovisa', 'emelie', 'patrik', 'ann',
  'ulrika', 'ursula', 'xi', 'caroline', 'lind', 'bagge', 'alupo', 'petra', 'gösta',
  'cedergren', 'manyan', 'ng', 'tymur', 'vasylyshyn', 'martin', 'anders', 'karin',
  'niclas', 'anna-maria', 'anna-karin', 'mattias', 'anna-lisa', 'anna-lena',
  'soren', 'soren', 'sophia', 'sofie', 'elin', 'cecilia', 'lisa', 'jessica',
  'rebecca', 'helena', 'margaret', 'margot', 'margret', 'marianne', 'marie',
  'marlene', 'martina', 'maude', 'maureen', 'maud', 'maxine', 'mayra'
]);

function isValidName(name) {
  if (!name || name.length < 3) return false;

  // Remove extra spaces
  name = name.trim();

  // Must have at least 2 parts (first + last name) or be longer than 6 chars
  const parts = name.split(/\s+/);
  if (parts.length < 2 && name.length < 7) return false;

  // Check if first part looks like a name
  if (parts.length >= 1) {
    const first = parts[0].toLowerCase();
    // Must have at least 2 letters and not be common stopwords
    if (first.length < 2) return false;
    if (['och', 'eller', 'detta', 'detta', 'från', 'för', 'med', 'kan', 'vad', 'hur', 'som', 'ett', 'en', 'av', 'på', 'vid', 'till', 'om', 'att', 'den', 'det', 'som', 'är', 'vi', 'er', 'de', 'du', 'jag'].includes(first)) return false;
  }

  // Skip if contains too many words (likely a phrase)
  if (parts.length > 4) return false;

  // Skip if contains common phrases that aren't names
  const lowerName = name.toLowerCase();
  const skipPhrases = [
    'almedalsveckan', 'region', 'kommun', 'myndighet', 'universitet', 'högskola',
    'organisation', 'föreningen', 'samarbetet', 'seminariet', 'panelen', 'forum',
    'workshop', 'träffpunkten', 'scenen', 'arenan', 'föreläsningen', 'presentationen',
    'diskussionen', 'debatten', 'mötet', 'samtalet', 'konferensen', 'seminaret',
    'förbundet', 'förbundets', 'tidigare', 'framtiden', 'förändring', 'utveckling',
    'samhälle', 'svenska', 'sverige', 'sverige', 'europa', 'världen', 'landet',
    'folket', 'medborgare', 'politiker', 'minister', 'statsråd', 'riksdag',
    'regering', 'kyrkan', 'staten', 'kommunen', 'regionen', 'välfärden',
    'hälsan', 'sjukvården', 'skolan', 'utbildningen', 'kulturen', 'ekonomin',
    'arbetet', 'jobbet', 'karriären', 'framgången', 'misstaget', 'problemet',
    'lösningen', 'vägen', 'gränsen', 'tiden', 'dagen', 'veckan', 'året',
    'föreningen jag', 'bättre shelter', 'operation', 'svenska rescuers', 'hogrens honungs'
  ];

  for (const phrase of skipPhrases) {
    if (lowerName.includes(phrase)) return false;
  }

  // Each part should start with capital letter (roughly)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    // Allow lowercase for middle parts that connect names (von, van, etc)
    if (i > 0 && ['von', 'van', 'de', 'di', 'da', 'le', 'la'].includes(part.toLowerCase())) {
      continue;
    }
    // Otherwise should look like a proper name part
    if (part.length > 0 && /^[A-Z]/.test(part) === false && i === 0) {
      return false; // First part should start with capital
    }
  }

  return true;
}

function extractSpeakersImproved(text) {
  if (!text) return [];

  const speakers = [];
  const seenNames = new Set();

  // Patterns for Swedish speaker mentions - more precise
  const patterns = [
    // "Sara Karlberg från Svenska Terapihundskolan" - explicit organization link
    {
      pattern: /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([A-Z][A-Zäöå\s&\-]+?)(?:\s+(?:och|om|har|kan|är)|,|\.|\n|$)/g,
      nameGroup: 1,
      orgGroup: 2,
      role: 'panelist'
    },
    // Titles followed by first name: "Rektor Sara Karlberg" or "Professor Erik Johansson"
    {
      pattern: /(?:Professor|Docent|Dr\.?|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen|Hundtränare|Etolog|Rektor|Familjebehandlare|Konsult|Expert|Specialist|Sjuksköterska|Läkare|Biologe|Ekonom|Projektledare|Verksamhetsledare|Initiativtagare|Vd|Grundare|Ägare)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g,
      nameGroup: 1,
      orgGroup: null,
      role: 'panelist'
    },
    // "Moderator: Sara Karlberg" or "Moderatorer: ..."
    {
      pattern: /(?:Moderator|Moderatorer):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g,
      nameGroup: 1,
      orgGroup: null,
      role: 'moderator'
    },
    // "Vi möter Sara Karlberg från..." or "Möt Sara Karlberg"
    {
      pattern: /(?:möta|träffa|möter|Möt|Möts|möts)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([A-Z][A-Zäöå\s&\-]+?)(?:\s+(?:och|om|har|kan|är|berättar)|,|\.|\n|$)/g,
      nameGroup: 1,
      orgGroup: 2,
      role: 'panelist'
    },
    // "Sara Karlberg, rektor vid Y-utbildning"
    {
      pattern: /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*),\s+(?:rektor|professor|doktor|direktör|ordförande|chef|fil\.?dr)[^,.\n]*(?:\s+(?:vid|för|på|från)\s+([^,.\n]+)|,|\.|\n|$)/g,
      nameGroup: 1,
      orgGroup: 2,
      role: 'panelist'
    },
    // Direct speaker mention: "Caroline Alupo berättar också"
    {
      pattern: /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+(?:berättar|diskuterar|presenterar|talar|säger|medverkar|deltar|presenterat|diskuterat)(?:\s+(?:om|kring|om|\sin|\sitt))?/g,
      nameGroup: 1,
      orgGroup: null,
      role: 'panelist'
    }
  ];

  patterns.forEach(({ pattern, nameGroup, orgGroup, role }) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let name = '';
      let org = '';

      try {
        if (nameGroup <= match.length - 1) {
          name = match[nameGroup].trim();
        }
        if (orgGroup && orgGroup <= match.length - 1 && match[orgGroup]) {
          org = match[orgGroup].trim();
        }
      } catch (e) {
        continue;
      }

      // Validate the extracted name
      if (!isValidName(name)) {
        continue;
      }

      // Clean up org if it has trailing junk
      if (org) {
        org = org.replace(/\s+(?:berättar|diskuterar|presenterar|talar|säger|medverkar|deltar|och|om|kan|är|har).*$/i, '').trim();
        if (org.length < 2) org = '';
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

    const speakers = extractSpeakersImproved(fullText);
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
console.log('NER Speaker Extraction (Improved) - Almedalsveckan 2025');
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
  console.log(`Avg per event: ${(totalAllSpeakers / totalEvents).toFixed(2)}`);
  console.log('='.repeat(60));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function extractSpeakersRegex(text) {
  if (!text) return [];

  const speakers = [];
  const seenNames = new Set();

  // Patterns for Swedish speaker mentions
  const patterns = [
    // "Sara Karlberg från Svenska Terapihundskolan"
    /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([^,.\n]+)/gi,

    // Titles followed by names: "Rektor Sara Karlberg" or "Familjebehandlare Cia Lilja"
    /(?:Professor|Docent|Dr|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen|Hundtränare|Etolog|Rektor|Familjebehandlare|Konsult|Expert|Specialist|Sjuksköterska|Läkare|Biologe|Ekonom|Projektledare|Verksamhetsledare|Initiativtagare|Vd|Grundare|Grundare|Ägare)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/gi,

    // Moderators
    /(?:Moderator|Moderatorer):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/gi,

    // "möta Sara Karlberg"
    /(?:möta|träffa|möts|möte\s+med)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/gi,

    // "samtal med X och Y" / "diskussion med X"
    /(?:samtal\s+med|diskussion\s+med|panel\s+med)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/gi,

    // "X, professor vid Y"
    /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*),\s+(?:professor|rektor|doktor|direktör|ordförande|chef)[^,.\n]*(?:\s+(?:vid|på|för|från)|,|\.|\n|$)/gi,

    // "Caroline Alupo berättar"
    /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+(?:berättar|diskuterar|talar|säger|medverkar|deltar|presenterar)/gi,

    // "Under dagen kan ni möta..."
    /(?:Under|I|Möt|Gäst|Uppträder)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/gi,
  ];

  patterns.forEach((pattern, idx) => {
    let match;
    // Reset regex for next iteration
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      let name = '';
      let org = '';
      let role = 'panelist';

      if (match.length >= 2) {
        // Try to determine which group has the name
        if (idx === 0 && match.length >= 3) {
          // "från" pattern: name is group 1, org is group 2
          name = match[1].trim();
          org = match[2].trim();
        } else {
          // Other patterns: use the first captured group that looks like a name
          for (let i = 1; i < match.length; i++) {
            if (match[i]) {
              name = match[i].trim();
              break;
            }
          }
        }

        // Skip invalid names
        if (!name || name.length < 3) continue;
        if (['moderator', 'moderatorer', 'panel', 'samtal', 'professor', 'doktor'].includes(name.toLowerCase())) continue;

        const parts = name.split(/\s+/);
        if (parts.length < 2 && name.length < 6) continue;

        // Determine role
        if (pattern.source.includes('Moderator')) {
          role = 'moderator';
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
    }
  });

  // Remove duplicates by name (case-insensitive)
  const uniqueSpeakers = [];
  const seen = new Set();
  speakers.forEach(s => {
    const key = s.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSpeakers.push(s);
    }
  });

  return uniqueSpeakers;
}

function processFile(inputPath, outputPath) {
  console.log(`\nProcessing ${path.basename(inputPath)}...`);

  const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
  if (!Array.isArray(input)) {
    throw new Error('Input must be JSON array');
  }

  const results = [];
  let totalSpeakers = 0;

  input.forEach((event, idx) => {
    const fullText = [
      event.title || '',
      event.description || '',
      event.extended_description || ''
    ].filter(Boolean).join('\n\n');

    const speakers = extractSpeakersRegex(fullText);
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
  console.log(`  ✓ Total speakers: ${totalSpeakers}`);
  console.log(`  ✓ Output: ${path.basename(outputPath)}`);

  return { eventCount: results.length, speakerCount: totalSpeakers };
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
console.log('NER Speaker Extraction for Almedalsveckan 2025');
console.log('='.repeat(60));

let totalEvents = 0;
let totalAllSpeakers = 0;

try {
  files.forEach(file => {
    const result = processFile(file.input, file.output);
    totalEvents += result.eventCount;
    totalAllSpeakers += result.speakerCount;
  });

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`Total events: ${totalEvents}`);
  console.log(`Total speakers: ${totalAllSpeakers}`);
  console.log(`Avg per event: ${(totalAllSpeakers / totalEvents).toFixed(2)}`);
  console.log('='.repeat(60));
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

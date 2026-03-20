const fs = require('fs');
const path = require('path');

const inputPath = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-19.json';
const outputPath = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-19.json';

const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function extractPeople(text) {
  if (!text) return [];

  const people = [];
  const seenNames = new Set();

  // Patterns to extract person names

  // 1. "Moderator/Moderatorer: Name" or "Moderator: Name, Name"
  const moderatorPattern = /(?:Moderator|Moderatorer|Moderator|präsidium|Panel):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*(?:(?:,\s*(?:och\s+)?[A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)*)?)/gi;

  // 2. "deltar/medverkar Name" patterns
  const participationPattern = /(?:deltar|medverkar|I samtalet(?:\s+\w+)?\s+(?:deltar|medverkar)|talar|säger|diskuterar|diskussion med)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g;

  // 3. "Name, Title/Org" format (e.g., "Erik Johansson, professor vid Lund")
  const titlePattern = /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*),\s+([^,\n]+?)(?:\s+(?:vid|på|från|och)\s+|,|\.|$|\n)/g;

  // 4. "Professor/Dr/Doktor Name" patterns
  const titlePrefixPattern = /(?:Professor|Docent|Dr\.?|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Riksdagsledamot|Advokat|Filmskaparen|Priorinnan|Prästen|Författaren|Universitetslektor|Forskar|Forskare)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g;

  // 5. Names in dialogue context "säger Name" or similar
  const dialoguePattern = /(?:säger|menar|tycker|anser|berättar|fortsätter|frågar)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g;

  // 6. "Samtal med Name" or "Samtal mellan Name och"
  const talkPattern = /(?:Samtal\s+(?:mellan|med))\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g;

  // 7. Time-based patterns like "10.00-10.20 Name" or "kl 10:00 Name"
  const timePrefixPattern = /(?:\d{1,2}:\d{2}|\d{1,2}\.\d{2})\s+(?:[A-Z][a-zäöå]+\s+)?([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)/g;

  // Apply patterns
  const patterns = [
    { regex: moderatorPattern, role: 'moderator' },
    { regex: participationPattern, role: 'panelist' },
    { regex: titlePattern, role: 'panelist', groupIndex: 1 },
    { regex: titlePrefixPattern, role: 'panelist' },
    { regex: dialoguePattern, role: 'panelist' },
    { regex: talkPattern, role: 'panelist' },
  ];

  for (const { regex, role, groupIndex = 1 } of patterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      let rawNames = match[groupIndex];

      // Handle multiple names separated by commas or "och"
      const names = rawNames
        .split(/(?:,\s*och\s+|och\s+|,\s*)/)
        .map(n => n.trim())
        .filter(n => n.length > 2 && /^[A-Z]/.test(n));

      for (const name of names) {
        // Skip common non-names
        if (['Moderator', 'Moderatorer', 'Panel', 'Samtal'].includes(name)) continue;

        // Check if this is actually a name (should have at least first and last name or be known)
        const parts = name.split(/\s+/);
        if (parts.length < 2 && name.length < 5) continue;

        if (!seenNames.has(name)) {
          seenNames.add(name);
          people.push({ name, title: '', org: '', role });
        }
      }
    }
  }

  return people;
}

// Process all events
const results = inputData.map((event, idx) => {
  const allText = [
    event.title || '',
    event.description || '',
    event.extended_description || ''
  ].join('\n');

  const speakers = extractPeople(allText);

  return {
    event_id: event.event_id,
    year: event.year,
    speakers
  };
});

// Write results
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

// Summary
let totalSpeakers = 0;
let eventsWithSpeakers = 0;
for (const result of results) {
  if (result.speakers.length > 0) {
    eventsWithSpeakers++;
    totalSpeakers += result.speakers.length;
  }
}

console.log(`✓ Processed ${results.length} events`);
console.log(`✓ Events with speakers: ${eventsWithSpeakers}`);
console.log(`✓ Total speaker mentions: ${totalSpeakers}`);
console.log(`✓ Output written to ${outputPath}`);

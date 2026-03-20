import fs from 'fs';

const inputPath = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-19.json';
const outputPath = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-19.json';

const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function cleanName(name) {
  // Remove trailing roles or descriptors
  return name
    .replace(/,.*$/g, '')
    .replace(/\s+vid\s+.+$/gi, '')
    .replace(/\s+från\s+.+$/gi, '')
    .replace(/\s+på\s+.+$/gi, '')
    .trim();
}

function extractPeople(text) {
  if (!text) return [];
  const people = [];
  const seen = new Set();

  // Pattern 1: "Moderator: Name" or "Moderatorer: Name, Name"
  const mod = /(?:Moderator|Moderatorer):\s*([^\n]+?)(?:\n|$)/gi;
  for (const match of text.matchAll(mod)) {
    const names = match[1].split(/,\s*och\s+|,\s+/);
    for (let n of names) {
      n = n.trim();
      if (/^[A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)+$/.test(n) && !seen.has(n)) {
        seen.add(n);
        people.push({ name: n, title: '', org: '', role: 'moderator' });
      }
    }
  }

  // Pattern 2: "I samtalet deltar/medverkar Name"
  const part = /(?:deltar|medverkar|I samtalet\s+(?:medverkar|deltar)|diskuterar|talar|Samtal\s+med|Samtal\s+mellan)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)+)/gi;
  for (const match of text.matchAll(part)) {
    const n = match[1].trim();
    if (!seen.has(n)) {
      seen.add(n);
      people.push({ name: n, title: '', org: '', role: 'panelist' });
    }
  }

  // Pattern 3: "Professor/Dr/Title Name"
  const title = /(?:Professor|Docent|Dr\.|Direktör|Minister|Ordförande|Chef|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen|Priorinnan|Universitetslektor|Forskare)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)+)/gi;
  for (const match of text.matchAll(title)) {
    const n = match[1].trim();
    if (!seen.has(n)) {
      seen.add(n);
      people.push({ name: n, title: '', org: '', role: 'panelist' });
    }
  }

  // Pattern 4: "Name, title/org format"
  const nameTitleOrg = /([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)+),\s+([^,\n]+?)(?:\s+(?:vid|på|från)\s+|,|\.|$|\n)/g;
  for (const match of text.matchAll(nameTitleOrg)) {
    const n = match[1].trim();
    if (!seen.has(n)) {
      seen.add(n);
      people.push({ name: n, title: '', org: '', role: 'panelist' });
    }
  }

  // Pattern 5: Time-prefixed names like "10.00-10.20 Name"
  const timePrefix = /\d{1,2}[:.]\d{2}[\s-]*\d{0,2}[:.]\d{0,2}\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)+)/g;
  for (const match of text.matchAll(timePrefix)) {
    const n = match[1].trim();
    if (!seen.has(n)) {
      seen.add(n);
      people.push({ name: n, title: '', org: '', role: 'panelist' });
    }
  }

  return people;
}

const results = inputData.map(event => {
  const allText = [event.title, event.description, event.extended_description]
    .filter(Boolean)
    .join('\n');
  const speakers = extractPeople(allText);
  return {
    event_id: event.event_id,
    year: event.year,
    speakers
  };
});

fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');

const totalSpeakers = results.reduce((sum, r) => sum + r.speakers.length, 0);
const eventsWithSpeakers = results.filter(r => r.speakers.length > 0).length;

console.log(`Processed ${results.length} events`);
console.log(`Events with speakers: ${eventsWithSpeakers}`);
console.log(`Total speaker mentions: ${totalSpeakers}`);

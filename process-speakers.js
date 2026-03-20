#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, 'tmp/ner-2025-input-4.json');
const outputFile = path.join(__dirname, 'tmp/ner-2025-result-4.json');

// Read the input file
const rawData = fs.readFileSync(inputFile, 'utf-8');
const events = JSON.parse(rawData);

function extractSpeakers(text) {
  if (!text) return [];

  const speakers = [];
  const processed = new Set();

  // Normalize text
  text = String(text).trim();

  // Pattern 1: "Talare:" section
  const talarMatch = text.match(/Talare\s*:?\s*([\s\S]*?)(?:\n\n|\[|Panelist|Moderator|$)/i);
  if (talarMatch) {
    const talarSection = talarMatch[1];
    const lines = talarSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('[') && !line.startsWith('*'));

    for (const line of lines) {
      // Try pattern: "Name, Title at Org"
      let match = line.match(/^([A-ZÄÖÅa-zäöå\s'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$/);
      if (match) {
        const name = match[1].trim();
        if (name.length > 2 && !processed.has(name.toLowerCase())) {
          speakers.push({
            name: name,
            title: match[2] ? match[2].trim() : '',
            org: match[3] ? match[3].trim() : '',
            role: 'panelist'
          });
          processed.add(name.toLowerCase());
        }
      }
    }
  }

  // Pattern 2: "Moderator:" or "Moderatorer:"
  const modMatch = text.match(/Moderator(?:er)?:?\s*([\s\S]*?)(?:\n\n|\nPanelist|\[|Talare|$)/i);
  if (modMatch) {
    const modSection = modMatch[1];
    const lines = modSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('['));

    for (const line of lines) {
      let match = line.match(/^([A-ZÄÖÅa-zäöå\s'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$/);
      if (match) {
        const name = match[1].trim();
        if (name.length > 2 && !processed.has(name.toLowerCase())) {
          speakers.push({
            name: name,
            title: match[2] ? match[2].trim() : '',
            org: match[3] ? match[3].trim() : '',
            role: 'moderator'
          });
          processed.add(name.toLowerCase());
        }
      }
    }
  }

  // Pattern 3: "Panelister:" or "Panelist:"
  const panelMatch = text.match(/Panelist(?:er)?:?\s*([\s\S]*?)(?:\n\n|\[|Talare|Moderator|$)/i);
  if (panelMatch) {
    const panelSection = panelMatch[1];
    const lines = panelSection.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('['));

    for (const line of lines) {
      let match = line.match(/^([A-ZÄÖÅa-zäöå\s'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$/);
      if (match) {
        const name = match[1].trim();
        if (name.length > 2 && !processed.has(name.toLowerCase())) {
          speakers.push({
            name: name,
            title: match[2] ? match[2].trim() : '',
            org: match[3] ? match[3].trim() : '',
            role: 'panelist'
          });
          processed.add(name.toLowerCase());
        }
      }
    }
  }

  return speakers;
}

// Process all events
const results = [];
for (const event of events) {
  let speakers = [];

  // Try extended_description first
  if (event.extended_description) {
    speakers = extractSpeakers(event.extended_description);
  }

  // If not found, try description
  if (speakers.length === 0 && event.description) {
    speakers = extractSpeakers(event.description);
  }

  // If still not found, try title
  if (speakers.length === 0 && event.title) {
    speakers = extractSpeakers(event.title);
  }

  results.push({
    event_id: event.event_id,
    year: 2025,
    speakers: speakers
  });
}

// Write output
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');

// Log summary
const totalSpeakers = results.reduce((sum, e) => sum + e.speakers.length, 0);
console.log(`Processed ${results.length} events`);
console.log(`Extracted ${totalSpeakers} speakers total`);
console.log(`Output written to: ${outputFile}`);

// Show sample
console.log('\nSample extractions:');
for (let i = 0; i < Math.min(3, results.length); i++) {
  if (results[i].speakers.length > 0) {
    console.log(`Event ${results[i].event_id}: ${results[i].speakers.length} speakers`);
    results[i].speakers.forEach(s => console.log(`  - ${s.name} (${s.role})`));
  }
}

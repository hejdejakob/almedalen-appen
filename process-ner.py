#!/usr/bin/env python3
import json
import re

input_path = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-19.json'
output_path = '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-19.json'

with open(input_path, 'r', encoding='utf-8') as f:
    events = json.load(f)

def extract_people(text):
    """Extract person names from Swedish text"""
    if not text:
        return []

    people = []
    seen_names = set()

    # Patterns for Swedish text
    patterns = [
        # Moderator patterns
        (r'(?:Moderator|Moderatorer):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'moderator'),

        # Participation patterns
        (r'(?:deltar|medverkar|talar|säger|diskuterar)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist'),

        # Title prefix patterns
        (r'(?:Professor|Docent|Dr|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist'),

        # Samtal patterns
        (r'(?:Samtal\s+(?:mellan|med))\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist'),

        # Name with title (e.g., "Erik Johansson, professor")
        (r'([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*),\s+(?:professor|docent|dr|direktör|ordförande|chef)[a-zäöå\s]*(?:\s+(?:vid|på|från)|,|\.|\n|$)', 'panelist'),
    ]

    for pattern, role in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE):
            name = match.group(1).strip()

            # Skip non-names
            if name in ['Moderator', 'Moderatorer', 'Panel', 'Samtal']:
                continue

            # Need at least 2 words or longer single word
            parts = name.split()
            if len(parts) < 2 and len(name) < 5:
                continue

            if name not in seen_names:
                seen_names.add(name)
                people.append({
                    'name': name,
                    'title': '',
                    'org': '',
                    'role': role
                })

    return people

results = []
for event in events:
    all_text = '\n'.join([
        event.get('title', ''),
        event.get('description', ''),
        event.get('extended_description', '')
    ])

    speakers = extract_people(all_text)

    results.append({
        'event_id': event['event_id'],
        'year': event['year'],
        'speakers': speakers
    })

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# Summary
total_speakers = sum(len(r['speakers']) for r in results)
events_with_speakers = sum(1 for r in results if r['speakers'])

print(f"✓ Processed {len(results)} events")
print(f"✓ Events with speakers: {events_with_speakers}")
print(f"✓ Total speaker mentions: {total_speakers}")
print(f"✓ Output written to {output_path}")

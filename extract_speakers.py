#!/usr/bin/env python3
import json
import re

# Read input file
with open('./tmp/ner-2025-input-4.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

def extract_speakers(text):
    """Extract speaker information from event text"""
    if not text:
        return []

    speakers = []

    # Pattern 1: "Talare:" section - speakers after this marker
    talar_match = re.search(r'Talare\s*:?\s*([\s\S]*?)(?:\n\n|\[|Panelist|Moderator|$)', text, re.IGNORECASE)
    if talar_match:
        talar_text = talar_match.group(1)
        lines = [l.strip() for l in talar_text.split('\n') if l.strip()]

        for line in lines:
            # Pattern: "Name, Title at Org" or "Name, Title"
            match = re.match(r'^([A-ZÄÖÅa-zäöå\s\'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$', line)
            if match:
                speakers.append({
                    'name': match.group(1).strip(),
                    'title': match.group(2).strip() if match.group(2) else '',
                    'org': match.group(3).strip() if match.group(3) else '',
                    'role': 'panelist'
                })

    # Pattern 2: "Moderator:" or "Moderatorer:"
    mod_match = re.search(r'Moderator(?:er)?:?\s*([\s\S]*?)(?:\n\n|\nPanelist|\[|Talare|$)', text, re.IGNORECASE)
    if mod_match:
        mod_text = mod_match.group(1)
        lines = [l.strip() for l in mod_text.split('\n') if l.strip()]

        for line in lines:
            match = re.match(r'^([A-ZÄÖÅa-zäöå\s\'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$', line)
            if match:
                speakers.append({
                    'name': match.group(1).strip(),
                    'title': match.group(2).strip() if match.group(2) else '',
                    'org': match.group(3).strip() if match.group(3) else '',
                    'role': 'moderator'
                })

    # Pattern 3: "Panelister:" or "Panelist:"
    panel_match = re.search(r'Panelist(?:er)?:?\s*([\s\S]*?)(?:\n\n|\[|Talare|Moderator|$)', text, re.IGNORECASE)
    if panel_match:
        panel_text = panel_match.group(1)
        lines = [l.strip() for l in panel_text.split('\n') if l.strip()]

        for line in lines:
            match = re.match(r'^([A-ZÄÖÅa-zäöå\s\'-]+?),\s*(.+?)(?:\s+(?:at|på)\s+(.+?))?$', line)
            if match:
                speakers.append({
                    'name': match.group(1).strip(),
                    'title': match.group(2).strip() if match.group(2) else '',
                    'org': match.group(3).strip() if match.group(3) else '',
                    'role': 'panelist'
                })

    return speakers

# Process all events
results = []
for event in data:
    speakers = []

    # Try extended_description first (most detailed)
    extracted = extract_speakers(event.get('extended_description', ''))
    speakers.extend(extracted)

    # If not found, try description
    if not speakers:
        extracted = extract_speakers(event.get('description', ''))
        speakers.extend(extracted)

    # Remove duplicates by name (case-insensitive)
    seen = set()
    unique_speakers = []
    for s in speakers:
        key = s['name'].lower()
        if key not in seen:
            seen.add(key)
            unique_speakers.append(s)

    results.append({
        'event_id': event['event_id'],
        'year': 2025,
        'speakers': unique_speakers
    })

# Write output
with open('./tmp/ner-2025-result-4.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"Extracted speakers for {len(results)} events")
total_speakers = sum(len(e['speakers']) for e in results)
print(f"Total speakers extracted: {total_speakers}")
print(f"Output: ./tmp/ner-2025-result-4.json")

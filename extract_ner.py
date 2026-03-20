#!/usr/bin/env python3
import json
import re

# Read the input file
with open('/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-17.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

results = []

# Common Swedish name patterns and titles
titles_keywords = [
    'professor', 'doktor', 'dr', 'fil.dr', 'väl', 'ordförande', 'vd', 'chef',
    'överläkare', 'läkare', 'sjuksköterska', 'forskare', 'expert', 'konsulent',
    'projektledare', 'direktör', 'generaldirektör', 'minister', 'statsråd',
    'riksdagsledamot', 'ledamot', 'politiker', 'advokat', 'jurist', 'ekonom',
    'ekonomichef', 'generalsekreterare', 'kommunikationschef', 'marknadschef'
]

role_keywords = {
    'moderator': ['moderator', 'modereras av', 'leder'],
    'panelist': ['i samtalet', 'deltar', 'medverkar', 'gäst', 'diskuterar'],
}

# Common Swedish first and last names for validation
common_first_names = {
    'anders', 'anna', 'anders', 'anna-karin', 'anna karin', 'erik', 'magnus',
    'maria', 'per', 'peter', 'lars', 'hans', 'jan', 'johannes', 'johan', 'jens',
    'mikael', 'michael', 'mats', 'nils', 'sven', 'ulf', 'anders', 'gustav',
    'gustav', 'kristina', 'kristin', 'karin', 'karen', 'linda', 'linda', 'lena',
    'monica', 'monica', 'birgitta', 'britta', 'ingrid', 'ingvar', 'ingemar',
    'thomas', 'tobias', 'tre', 'tre', 'kenneth', 'kenneth', 'olle', 'gunnar',
    'gunnar', 'göran', 'göte', 'frank', 'frank', 'carl', 'karl', 'klaus',
    'klaus', 'cia', 'sara', 'christian', 'john', 'johannes', 'sara', 'johanna',
    'lotta', 'anders', 'anders', 'lovisa', 'emelie', 'patrik', 'kristin',
    'ann', 'ann-kristin', 'ulrika', 'anna-karin', 'ursula', 'xi',
    'caroline', 'anders', 'johanna', 'anders', 'lind', 'bagge', 'alupo'
}

def clean_name(name):
    """Clean and normalize a name string."""
    name = name.strip()
    # Remove titles and common phrases
    for title in titles_keywords:
        name = re.sub(rf'\b{title}\b', '', name, flags=re.IGNORECASE)
    # Remove extra whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    # Remove common suffixes like "AB", "GmbH", etc
    name = re.sub(r'\s+(AB|GmbH|Ltd|Inc|AS|ASA|Oy)$', '', name, flags=re.IGNORECASE)
    return name

def extract_people(text):
    """Extract person names from text using pattern matching."""
    if not text:
        return []

    people = []
    text_lower = text.lower()

    # Pattern 1: "In samtalet deltar X" or "samtalen deltar" variations
    pattern1 = r'(?:i samtalet|i detta samtal|i seminariet|panelen|panelen består|medverkar|deltar)\s+(?:av\s+)?([A-Z][a-zäåö]+(?:\s+[A-Z][a-zäåö]+)*)'
    matches1 = re.finditer(pattern1, text)
    for match in matches1:
        name = clean_name(match.group(1))
        if len(name.split()) >= 2 and name and name not in [p['name'] for p in people]:
            people.append({'name': name, 'title': '', 'org': '', 'role': 'panelist'})

    # Pattern 2: "X från Y" or "X som [title/role]"
    pattern2 = r'([A-Z][a-zäåö]+(?:\s+[A-Z][a-zäåö]+)*)\s+(?:från|på|vid|med\s+uppdrag\s+från)\s+([A-Z][A-Zäåö\s&]+)'
    matches2 = re.finditer(pattern2, text)
    for match in matches2:
        name = clean_name(match.group(1))
        org = clean_name(match.group(2)).strip(',')
        if len(name.split()) >= 2 and name and name not in [p['name'] for p in people]:
            people.append({'name': name, 'title': '', 'org': org, 'role': 'panelist'})

    # Pattern 3: "Moderator: X" or "Moderatorer:"
    pattern3 = r'(?:moderator|moderatorer):\s*([A-Z][a-zäåö]+(?:\s+[A-Z][a-zäåö]+)*)'
    matches3 = re.finditer(pattern3, text, flags=re.IGNORECASE)
    for match in matches3:
        name = clean_name(match.group(1))
        if len(name.split()) >= 2 and name and name not in [p['name'] for p in people]:
            people.append({'name': name, 'title': '', 'org': '', 'role': 'moderator'})

    # Pattern 4: "X, [title]" format
    pattern4 = r'([A-Z][a-zäåö]+(?:\s+[A-Z][a-zäåö]+)*),\s*([A-Za-zäåö\s]+?)(?:\s+på\s+([^,.]+)|[,.])'
    matches4 = re.finditer(pattern4, text)
    for match in matches4:
        name = clean_name(match.group(1))
        title = clean_name(match.group(2)) if match.group(2) else ''
        org = clean_name(match.group(3)) if match.group(3) else ''
        if len(name.split()) >= 2 and name and name not in [p['name'] for p in people]:
            people.append({'name': name, 'title': title, 'org': org, 'role': 'panelist'})

    # Remove duplicates (case-insensitive)
    seen = set()
    unique_people = []
    for p in people:
        key = p['name'].lower()
        if key not in seen:
            seen.add(key)
            unique_people.append(p)

    # Filter out common words that are not names
    filtered = []
    for p in unique_people:
        name_lower = p['name'].lower()
        # Skip single words and organizational/generic terms
        if name_lower not in ['almedalen', 'sverige', 'hälso', 'sjukvård', 'seminariet', 'panelen',
                               'region', 'kommun', 'myndighet', 'universitet', 'högskola']:
            filtered.append(p)

    return filtered

# Process each event
for event in data:
    event_id = event.get('event_id')
    year = event.get('year', 2025)
    title = event.get('title', '')
    description = event.get('description', '')
    extended = event.get('extended_description', '')

    # Combine all text
    full_text = f"{title}. {description}. {extended}"

    speakers = extract_people(full_text)

    results.append({
        'event_id': event_id,
        'year': year,
        'speakers': speakers
    })

# Write output
with open('/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-17.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"Processed {len(results)} events")
print(f"Total speakers extracted: {sum(len(e['speakers']) for e in results)}")

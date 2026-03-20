#!/usr/bin/env python3
"""
Swedish NER for Almedalen 2025 events.
Extracts person names, titles, organizations, and roles.
"""

import json
import re
from typing import List, Dict, Any

def extract_speakers(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract speakers from event text fields."""

    results = []

    # Common Swedish title patterns
    title_patterns = [
        r'ordförande|vice[ -]?ordförande|vd|ceo|chef|direktör|professor|docent',
        r'minister|riksdagsledamot|ledamot|ambassadör|generaldirektör',
        r'startskapare|grundare|läkare|politiker|expert|analytiker',
        r'konsulent|rådgivare|jurist|ekonom|ingenjör',
    ]

    # Common phrase patterns for speaker mentions
    speaker_patterns = [
        r'(?:Medverkande|I panelen|Paneldeltagare|Speaker|Moderator|Talare|Talarna):\s*(.+?)(?:\n|$)',
        r'(?:Med|Tillsammans med|Tillsammans med|Speakers?:)\s+([A-Z][a-zäöå]+\s+[A-Z][a-zäöå]+)(?:,|\.|;|\n)',
        r'([A-Z][a-zäöå]+\s+[A-Z][a-zäöå]+)(?:\s*\(([^)]+)\))?(?:\s*-\s*([^,\n]+))?',
    ]

    for event in events:
        event_id = str(event.get('event_id', ''))
        year = event.get('year', 2025)
        title = event.get('title', '')
        description = event.get('description', '')
        extended = event.get('extended_description', '')

        # Combine all text fields
        full_text = f"{title} {description} {extended}".lower()

        speakers = []

        # Extract names and context
        # Look for patterns like "Name, Title, Organization" or "Name (Organization)"

        # Pattern 1: Name (Organization) - Title
        name_org_pattern = r'([A-Z][a-zäöå]+\s+(?:[A-Z][a-zäöå]+\s+)*[A-Z][a-zäöå]+)\s*\(\s*([^)]+)\s*\)'
        for match in re.finditer(name_org_pattern, event.get('extended_description', '') + ' ' + event.get('description', '')):
            name = match.group(1).strip()
            org = match.group(2).strip()

            if name and len(name.split()) >= 2:  # At least first and last name
                speakers.append({
                    'name': name,
                    'title': '',
                    'org': org if org and 'almedalsdata' not in org.lower() else '',
                    'role': 'panelist'
                })

        # Pattern 2: "Medverkande: Name" or "I panelen: Name"
        medverkande_pattern = r'(?:Medverkande|I panelen|Paneldeltagare):\s*([A-Z][a-zäöå]+\s+[A-Z][a-zäöå]+)'
        combined_text = (event.get('extended_description', '') or '') + ' ' + (event.get('description', '') or '')
        for match in re.finditer(medverkande_pattern, combined_text):
            name = match.group(1).strip()
            if name:
                speakers.append({
                    'name': name,
                    'title': '',
                    'org': '',
                    'role': 'panelist'
                })

        # Pattern 3: Check for role indicators
        text_upper = event.get('extended_description', '') + ' ' + event.get('description', '')

        if 'moderator' in text_upper.lower():
            # Try to find moderator name before "moderator"
            mod_pattern = r'([A-Z][a-zäöå]+\s+[A-Z][a-zäöå]+)\s+(?:as\s+)?moderator|moderator[:\s]+([A-Z][a-zäöå]+\s+[A-Z][a-zäöå]+)'
            for match in re.finditer(mod_pattern, text_upper, re.IGNORECASE):
                for group in match.groups():
                    if group:
                        speakers.append({
                            'name': group.strip(),
                            'title': '',
                            'org': '',
                            'role': 'moderator'
                        })

        # Deduplicate speakers by name
        seen_names = set()
        unique_speakers = []
        for speaker in speakers:
            if speaker['name'] not in seen_names:
                seen_names.add(speaker['name'])
                unique_speakers.append(speaker)

        results.append({
            'event_id': event_id,
            'year': year,
            'speakers': unique_speakers
        })

    return results


def main():
    # Read input
    with open('/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner-2025-input-1.json', 'r', encoding='utf-8') as f:
        events = json.load(f)

    # Extract speakers
    results = extract_speakers(events)

    # Write output
    with open('/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner-2025-result-1.json', 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Processed {len(results)} events")
    speakers_found = sum(len(r['speakers']) for r in results)
    print(f"Found {speakers_found} total speaker mentions")


if __name__ == '__main__':
    main()

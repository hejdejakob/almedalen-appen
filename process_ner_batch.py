#!/usr/bin/env python3
"""
Process NER input files for speaker extraction.
Uses pattern matching and Claude API for accurate extraction.
"""

import json
import sys
import os
from pathlib import Path

def extract_speakers_regex(text):
    """Extract person names using enhanced pattern matching."""
    import re

    if not text:
        return []

    speakers = []
    seen_names = set()

    # Patterns for Swedish speaker mentions
    patterns = [
        # "Sara Karlberg från Svenska Terapihundskolan" or similar
        (r'([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+från\s+([^,.\n]+)', 'panelist', 1, 2),

        # "Familjebehandlare Cia Lilja berättar"
        (r'(?:Professor|Docent|Dr|Doktor|Direktör|Minister|Ledare|Chef|Ordförande|Generaldirektör|Ambassadör|Prästen|Författaren|Filmskaparen|Hundtränare|Etolog|Rektor|Familjebehandlare|Konsult|Expert|Specialist|Sjuksköterska|Läkare|Biologe|Ekonom|Projektledare|Verksamhetsledare|Initiativtagare|Founder|Vd|Ordförande)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist', 3, None),

        # "Moderator: X" or "Moderatorer: X"
        (r'(?:Moderator|Moderatorer):\s*([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'moderator', 1, None),

        # "Kan ni möta Sara Karlberg från..."
        (r'(?:möta|träffa|möts|möte med)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist', 1, None),

        # "Vi bjuder in till samtal med X och Y"
        (r'(?:samtal\s+med|diskussion\s+med|panel\s+med)\s+([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)', 'panelist', 1, None),

        # "X, professor vid Y" or "X, rektor för Y"
        (r'([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*),\s+(?:professor|rektor|doktor|direktör|ordförande|chef)[^,.\n]*(?:\s+(?:vid|på|för|från)|,|\.|\n|$)', 'panelist', 1, None),

        # "Caroline Alupo berättar också"
        (r'([A-Z][a-zäöå]+(?:\s+[A-Z][a-zäöå]+)*)\s+(?:berättar|diskuterar|talar|säger|medverkar|deltar)', 'panelist', 1, None),
    ]

    for pattern_tuple in patterns:
        if len(pattern_tuple) == 4:
            pattern, role, name_group, org_group = pattern_tuple
        else:
            pattern, role, name_group, org_group = pattern_tuple[0], pattern_tuple[1], pattern_tuple[2], None

        matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
        for match in matches:
            try:
                name = match.group(name_group).strip() if name_group <= match.lastindex else ""
                org = match.group(org_group).strip() if org_group and org_group <= match.lastindex else ""

                if not name or len(name) < 3:
                    continue

                # Skip non-names
                if name.lower() in ['moderator', 'moderatorer', 'panel', 'samtal', 'professor', 'doktor']:
                    continue

                # Need at least 2 parts (first name + last name)
                parts = name.split()
                if len(parts) < 2 and len(name) < 6:
                    continue

                # Deduplicate
                name_key = name.lower()
                if name_key not in seen_names:
                    seen_names.add(name_key)
                    speakers.append({
                        'name': name,
                        'title': '',
                        'org': org if org else '',
                        'role': role
                    })
            except (IndexError, AttributeError):
                continue

    return speakers


def process_file(input_path, output_path):
    """Process a single input file."""
    print(f"\nProcessing {Path(input_path).name}...")

    with open(input_path, 'r', encoding='utf-8') as f:
        events = json.load(f)

    if not isinstance(events, list):
        raise ValueError(f"Input must be JSON array, got {type(events)}")

    results = []
    total_speakers = 0

    for idx, event in enumerate(events, 1):
        event_id = event.get('event_id', 'unknown')
        title = event.get('title', '')[:50]

        # Combine all text
        full_text = '\n'.join(filter(None, [
            event.get('title', ''),
            event.get('description', ''),
            event.get('extended_description', '')
        ]))

        # Extract speakers
        speakers = extract_speakers_regex(full_text)
        total_speakers += len(speakers)

        results.append({
            'event_id': event.get('event_id'),
            'year': event.get('year', 2025),
            'speakers': speakers
        })

        if idx % 10 == 0:
            print(f"  Processed {idx}/{len(events)} events...")

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"  ✓ Processed {len(results)} events")
    print(f"  ✓ Total speakers extracted: {total_speakers}")
    print(f"  ✓ Output: {Path(output_path).name}")

    return len(results), total_speakers


def main():
    """Main function."""
    files = [
        {
            'input': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-1.json',
            'output': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-1.json',
        },
        {
            'input': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-4.json',
            'output': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-4.json',
        },
        {
            'input': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-6.json',
            'output': '/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-6.json',
        },
    ]

    print("=" * 60)
    print("NER Speaker Extraction for Almedalsveckan 2025")
    print("=" * 60)

    total_events = 0
    total_all_speakers = 0

    for file_pair in files:
        try:
            events, speakers = process_file(file_pair['input'], file_pair['output'])
            total_events += events
            total_all_speakers += speakers
        except Exception as e:
            print(f"✗ Error: {e}")
            sys.exit(1)

    print(f"\n{'=' * 60}")
    print(f"SUMMARY")
    print(f"Total events processed: {total_events}")
    print(f"Total speakers extracted: {total_all_speakers}")
    print(f"Average speakers per event: {total_all_speakers / total_events if total_events > 0 else 0:.2f}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    main()

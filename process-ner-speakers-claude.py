#!/usr/bin/env python3
"""
Process three NER input files using Claude API to extract speakers.
Uses claude-sonnet-4-6 for high-precision NER extraction.
"""

import json
import os
import sys
from pathlib import Path
from anthropic import Anthropic

# Initialize Anthropic client (uses ANTHROPIC_API_KEY env var)
client = Anthropic()

SYSTEM_PROMPT = """You are a Swedish speaker/panelist name extraction expert for Almedalsveckan (Swedish political conference).

Your task: Extract EVERY person name that appears to be a speaker, panelist, moderator, or participant in the event text.

Rules:
1. Extract ONLY person names (e.g., "Sara Karlberg", "Cia Lilja", "Caroline Alupo"), NOT organization names
2. For each person, include:
   - name: The person's full name as it appears
   - title: Job title/role if mentioned (e.g., "rektor", "familjebehandlare", "etolog"). Use empty string if not found.
   - org: Organization/company if mentioned (e.g., "Svenska Terapihundskolan"). Use empty string if not found.
   - role: Use "moderator" if explicitly stated as moderator. Otherwise use "panelist". Default to "panelist" if unclear.
3. IMPORTANT: Include ALL people mentioned who could reasonably be speakers/panelists, including:
   - People explicitly named as speakers or panelists
   - People quoted or mentioned as experts/participants
   - Founders/leaders mentioned in context of the event
   - Researchers or practitioners mentioned as contributing
4. Do NOT include people only mentioned in background/historical context or as examples of problems/issues
5. Do NOT include fictional people or historical figures mentioned only as context
6. Do NOT include people mentioned only in quotes without context suggesting they're panel participants
7. Deduplicate by exact name match - if same person appears twice, only include once
8. Swedish names are common - be generous in extracting, don't be overly restrictive

Return ONLY valid JSON array with objects containing: {name, title, org, role}
Return empty array [] if no speakers found.
Do NOT include any additional text, only the JSON array."""


def extract_speakers_from_event(event):
    """Extract speakers from a single event using Claude API."""
    full_text = "\n\n".join(
        filter(
            None,
            [
                event.get("title", ""),
                event.get("description", ""),
                event.get("extended_description", ""),
            ],
        )
    )

    if not full_text.strip():
        return []

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"Extract all speakers/panelists from this event:\n\n{full_text}",
                }
            ],
        )

        content = response.content[0].text if response.content else ""

        # Parse JSON response
        speakers = json.loads(content)

        if not isinstance(speakers, list):
            print(f"    Warning: Response is not a list for event {event.get('event_id')}")
            return []

        # Validate and clean speakers
        validated = []
        for s in speakers:
            if not isinstance(s, dict) or "name" not in s:
                continue

            validated.append(
                {
                    "name": str(s.get("name", "")).strip(),
                    "title": str(s.get("title", "")).strip() if s.get("title") else "",
                    "org": str(s.get("org", "")).strip() if s.get("org") else "",
                    "role": (
                        str(s.get("role", "panelist")).lower()
                        if s.get("role") in ["moderator", "panelist"]
                        else "panelist"
                    ),
                }
            )

        # Deduplicate by name
        seen_names = set()
        final = []
        for s in validated:
            if s["name"] and s["name"] not in seen_names:
                seen_names.add(s["name"])
                final.append(s)

        return final

    except json.JSONDecodeError as e:
        print(f"    Error: Invalid JSON response for event {event.get('event_id')}: {e}")
        return []
    except Exception as e:
        print(f"    Error processing event {event.get('event_id')}: {e}")
        return []


def process_file(input_path, output_path):
    """Process a single NER input file."""
    print(f"\nProcessing {Path(input_path).name}...")

    with open(input_path, "r", encoding="utf-8") as f:
        events = json.load(f)

    if not isinstance(events, list):
        raise ValueError("Input file must contain a JSON array")

    results = []
    total_speakers = 0

    for idx, event in enumerate(events, 1):
        event_id = event.get("event_id", "unknown")
        title = event.get("title", "")[:50]
        print(f"  [{idx}/{len(events)}] Event {event_id}: {title}...")

        speakers = extract_speakers_from_event(event)
        total_speakers += len(speakers)

        results.append(
            {
                "event_id": event.get("event_id"),
                "year": event.get("year", 2025),
                "speakers": speakers,
            }
        )

    # Write results
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"  ✓ Processed {len(results)} events")
    print(f"  ✓ Total speakers extracted: {total_speakers}")
    print(f"  ✓ Output written to {Path(output_path).name}")

    return len(results), total_speakers


def main():
    """Process three input files."""
    files = [
        {
            "input": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-1.json",
            "output": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-1.json",
        },
        {
            "input": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-4.json",
            "output": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-4.json",
        },
        {
            "input": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-6.json",
            "output": "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-6.json",
        },
    ]

    total_events = 0
    total_all_speakers = 0

    for file_pair in files:
        try:
            events, speakers = process_file(file_pair["input"], file_pair["output"])
            total_events += events
            total_all_speakers += speakers
        except Exception as e:
            print(f"✗ Error processing {file_pair['input']}: {e}")

    print(f"\n{'=' * 60}")
    print(f"COMPLETE: Processed {total_events} events total")
    print(f"COMPLETE: Extracted {total_all_speakers} speaker mentions total")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()

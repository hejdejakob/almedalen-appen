#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from anthropic import Anthropic

client = Anthropic()

NER_PROMPT = """You are an expert at Named Entity Recognition (NER) focused on identifying person names who are speakers, panelists, moderators, or participants in events.

Read the event text carefully and extract ONLY person names (first name + last name or full name) who appear to be speakers, panelists, moderators, or participants in the event.

Rules:
1. Extract ONLY person names - no organizations, no generic terms
2. Look for explicit mentions like "speakers:", "panelists:", "moderator:", or context clues about participation
3. Include people mentioned as experts, speakers, or participants in the discussion
4. Do NOT include authors of quoted articles unless they are explicitly mentioned as speakers
5. If title or org/affiliation is mentioned near the name, include it
6. For role: use "moderator" if stated, "panelist" for speakers/participants, "speaker" for main presenters

Return a JSON array like this:
[
  {"name": "John Smith", "title": "", "org": "Organization Name", "role": "moderator"},
  {"name": "Jane Doe", "title": "CEO", "org": "Company", "role": "panelist"}
]

If no person names found, return empty array [].

TEXT TO ANALYZE:
"""

def extract_speakers(event):
    """Extract speakers from event using Claude NER"""

    # Combine all text fields
    full_text = f"""
Title: {event.get('title', '')}
Description: {event.get('description', '')}
Extended Description: {event.get('extended_description', '')}
"""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            messages=[
                {
                    "role": "user",
                    "content": NER_PROMPT + full_text
                }
            ]
        )

        # Extract JSON from response
        response_text = response.content[0].text

        # Try to parse JSON from response
        try:
            speakers = json.loads(response_text)
            if not isinstance(speakers, list):
                speakers = []
        except json.JSONDecodeError:
            # Try to extract JSON array from text
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start != -1 and end > start:
                try:
                    speakers = json.loads(response_text[start:end])
                except:
                    speakers = []
            else:
                speakers = []

        return speakers if speakers else []

    except Exception as e:
        print(f"Error processing event {event.get('event_id')}: {e}", file=sys.stderr)
        return []

def process_file(input_path, output_path):
    """Process a single NER input file"""

    print(f"Processing {input_path}...", file=sys.stderr)

    # Read input
    with open(input_path, 'r', encoding='utf-8') as f:
        events = json.load(f)

    results = []

    for i, event in enumerate(events, 1):
        event_id = event.get('event_id')
        year = event.get('year', 2025)

        # Extract speakers
        speakers = extract_speakers(event)

        result = {
            "event_id": event_id,
            "year": year,
            "speakers": speakers
        }

        results.append(result)

        if i % 10 == 0:
            print(f"  Processed {i} events...", file=sys.stderr)

    # Write output
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"✓ Wrote {len(results)} results to {output_path}", file=sys.stderr)
    return len(results)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python process_ner_speakers.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    count = process_file(input_path, output_path)
    print(f"Completed: {count} events processed")

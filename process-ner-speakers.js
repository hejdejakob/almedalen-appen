#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

const SYSTEM_PROMPT = `You are a Swedish speaker/panelist name extraction expert for Almedalsveckan (Swedish political conference).

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
Return empty array [] if no speakers found.`;

async function extractSpeakersFromEvent(event) {
  const fullText = [event.title, event.description, event.extended_description]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract all speakers/panelists from this event:\n\n${fullText}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return [];
    }

    // Parse the JSON response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn(`Could not find JSON array in response for event ${event.event_id}`);
      return [];
    }

    const speakers = JSON.parse(jsonMatch[0]);

    // Validate and clean speakers
    return speakers
      .filter((s) => s.name && typeof s.name === "string")
      .map((s) => ({
        name: s.name.trim(),
        title: s.title ? String(s.title).trim() : "",
        org: s.org ? String(s.org).trim() : "",
        role: ["moderator", "panelist"].includes(String(s.role).toLowerCase())
          ? String(s.role).toLowerCase()
          : "panelist",
      }))
      .filter((s, idx, arr) => arr.findIndex((x) => x.name === s.name) === idx); // Deduplicate by name
  } catch (error) {
    console.error(`Error processing event ${event.event_id}:`, error.message);
    return [];
  }
}

async function processFile(inputPath, outputPath) {
  console.log(`Processing ${inputPath}...`);

  const input = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  if (!Array.isArray(input)) {
    throw new Error("Input file must contain a JSON array");
  }

  const results = [];

  for (let i = 0; i < input.length; i++) {
    const event = input[i];
    console.log(
      `  Event ${i + 1}/${input.length}: ${event.event_id} - "${event.title.substring(0, 50)}..."`
    );

    const speakers = await extractSpeakersFromEvent(event);
    results.push({
      event_id: event.event_id,
      year: event.year,
      speakers: speakers,
    });

    // Add a small delay to avoid rate limiting
    if (i < input.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Written ${results.length} events to ${outputPath}`);
}

async function main() {
  const files = [
    {
      input: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-1.json",
      output: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-1.json",
    },
    {
      input: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-4.json",
      output: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-4.json",
    },
    {
      input: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-input-6.json",
      output: "/Users/jakobohlsson/Documents/LinkeDink-App/almedalen-appen/tmp/ner2-2025-result-6.json",
    },
  ];

  for (const file of files) {
    try {
      await processFile(file.input, file.output);
      console.log(`✓ Completed ${path.basename(file.output)}\n`);
    } catch (error) {
      console.error(`✗ Error processing ${file.input}:`, error.message);
    }
  }
}

main().catch(console.error);

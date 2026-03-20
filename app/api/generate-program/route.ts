import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import type { QuizState } from "@/lib/quiz-data";
import { rateLimit } from "@/lib/rate-limit";

const DAY_MAP: Record<string, string> = {
  "mon-29": "måndag",
  "tue-30": "tisdag",
  "wed-01": "onsdag",
  "thu-02": "torsdag",
  "fri-03": "fredag",
};

const DAY_LABEL: Record<string, string> = {
  "mon-29": "Måndag 29 juni",
  "tue-30": "Tisdag 30 juni",
  "wed-01": "Onsdag 1 juli",
  "thu-02": "Torsdag 2 juli",
  "fri-03": "Fredag 3 juli",
};

interface SlimEvent {
  id: string;
  title: string;
  day: string;
  days: string[];
  start_time: string;
  end_time: string;
  organizer: string;
  topic: string;
  event_type: string;
}

interface FullEvent {
  id: string;
  title: string;
  day: string;
  date: string;
  start_time: string;
  end_time: string;
  organizer: string;
  topic: string;
  secondary_topic: string;
  event_type: string;
  location: string;
  description: string;
  extended_description: string;
  url: string;
  tags: string[];
  refreshments: boolean;
  language: string;
}

function jsonError(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_DAYS = new Set(["mon-29", "tue-30", "wed-01", "thu-02", "fri-03"]);
const MAX_FIELD_LENGTH = 1000;

function validateInput(state: unknown): string | null {
  if (!state || typeof state !== "object") return "Ogiltig request body";
  const s = state as Record<string, unknown>;

  if (!Array.isArray(s.days) || s.days.length === 0)
    return "days måste vara en icke-tom array";
  for (const d of s.days) {
    if (!VALID_DAYS.has(d)) return `Ogiltig dag: ${d}`;
  }

  for (const field of ["role", "focusArea", "passion"] as const) {
    const val = s[field];
    if (typeof val !== "string" || val.trim().length === 0)
      return `${field} måste vara en icke-tom sträng`;
    if (val.length > MAX_FIELD_LENGTH)
      return `${field} får vara max ${MAX_FIELD_LENGTH} tecken`;
  }

  if (s.preferences !== undefined && typeof s.preferences === "string" && s.preferences.length > MAX_FIELD_LENGTH)
    return `preferences får vara max ${MAX_FIELD_LENGTH} tecken`;

  return null;
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const { allowed, retryAfterMs } = rateLimit(ip);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "För många anrop. Försök igen senare." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((retryAfterMs || 3600000) / 1000)),
          },
        }
      );
    }

    const body = await request.json();

    // Input validation
    const validationError = validateInput(body);
    if (validationError) {
      return jsonError(validationError, 400);
    }

    const state = body as QuizState;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonError("ANTHROPIC_API_KEY is not configured");
    }

    const client = new Anthropic({ apiKey });

    // Load and filter events
    const raw = readFileSync(
      join(process.cwd(), "public/almedalen-2026.json"),
      "utf-8"
    );
    const data = JSON.parse(raw);
    const allEvents: FullEvent[] = data.events;

    const selectedDayNames = state.days.map((d) => DAY_MAP[d]);
    const filteredEvents = allEvents.filter((e) =>
      selectedDayNames.includes(e.day)
    );

    // Deduplicate by event ID, collecting all days each event spans
    const eventMap = new Map<string, FullEvent & { days: string[] }>();
    for (const e of filteredEvents) {
      const existing = eventMap.get(e.id);
      if (existing) {
        if (!existing.days.includes(e.day)) {
          existing.days.push(e.day);
        }
      } else {
        eventMap.set(e.id, { ...e, days: [e.day] });
      }
    }
    const deduplicatedEvents = [...eventMap.values()];

    // Slim events for selection call
    const slimEvents: SlimEvent[] = deduplicatedEvents.map((e) => ({
      id: e.id,
      title: e.title,
      day: e.day,
      days: e.days,
      start_time: e.start_time,
      end_time: e.end_time,
      organizer: e.organizer,
      topic: e.topic,
      event_type: e.event_type,
    }));

    const dayLabels = state.days.map((d) => DAY_LABEL[d]).join(", ");

    // Collect unique topics for context
    const uniqueTopics = [...new Set(slimEvents.map((e) => e.topic))];

    // ── Call 1: Select 150 events via Haiku (fast, non-streamed) ──
    let selectionResponse;
    try {
      selectionResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 8192,
        system: `Du är expert på svensk politik, samhällsdebatt och Almedalsveckan.

Din uppgift är att välja ut 150 events för en specifik person — men med TEMATISK BREDD. Ett bra Almedalsprogram är inte 150 varianter av samma seminarium. Det måste vara roligt, oväntat, smart och genomtänkt. Tänk att du är en personlig concierge och politisk insider med djup kunskap om detta. Målgruppen är inte förstagångsbesökare utan folk som kan sin sak så det är viktigt att du också är smart när du kommer på förslag.

Fördelning:
- **Kärna (~90 st):** Direkt relevanta för personens passion och fokusområde
- **Angränsande (~40 st):** Relaterade men från ANDRA ämnesområden. Om passion=Ukraina, välj events om energipolitik, EU, demokrati, mediefrihet — inte fler säkerhetsseminarier
- **Vildkort (~50 st):** Helt andra ämnen som breddar — kultur, innovation, hälsa, digitalisering. Saker personen inte visste att de behövde. Överraska. Använd humor. Leta efter sånt som är kul.

Sprid valen över FLERA av dessa topics: ${uniqueTopics.join(", ")}
Blanda även event_type — inte bara seminarier, utan även debatter, träffpunkter, mingel etc.

Returnera ENBART JSON i formatet: { "selected_ids": ["id1", "id2", ...] }. Inga förklaringar.`,
        messages: [
          {
            role: "user",
            content: `## Person
- Roll: ${state.role}
- Officiell anledning att vara i Almedalen: ${state.focusArea}
- Brinner för: ${state.passion}
- Önskemål/undvika: ${state.preferences || "Inga specifika"}
- Dagar på plats: ${dayLabels}

## Events (${slimEvents.length} st)
${JSON.stringify(slimEvents)}

Välj ut 150 events med tematisk bredd enligt instruktionerna. Returnera JSON: { "selected_ids": [...] }`,
          },
        ],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Anthropic Call 1 error:", msg);
      return jsonError(`AI-anrop 1 misslyckades: ${msg}`);
    }

    const selectionText =
      selectionResponse.content[0].type === "text"
        ? selectionResponse.content[0].text
        : "";

    let selectedIds: string[];
    try {
      const jsonMatch = selectionText.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : selectionText);
      selectedIds = parsed.selected_ids;
    } catch {
      console.error("Failed to parse selection:", selectionText.slice(0, 500));
      return jsonError("Failed to parse event selection");
    }

    // Get full event data for selected IDs (from deduplicated list)
    const selectedEvents = deduplicatedEvents.filter((e) =>
      selectedIds.includes(e.id)
    );

    // ── Call 2: Generate program (streamed) ──
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
      system: `Du är en assistent som hjälper folk navigera Almedalsveckan 2026.
	  
Din uppgift är att välja ut events för en specifik person — men med TEMATISK BREDD. Ett bra Almedalsprogram är inte 150 varianter av samma seminarium. Det måste vara roligt, oväntat, smart och genomtänkt. Tänk att du är en personlig concierge och politisk insider med djup kunskap om detta. Målgruppen är inte förstagångsbesökare utan folk som kan sin sak så det är viktigt att du också är smart när du kommer på förslag

Din uppgift är att presentera relevanta events baserat på personens quiz-svar. Du ska INTE schemalägga, prioritera. det är personens jobb.

REGLER:
- Events som sträcker sig över mer än 3 timmar räknas som heldagsevents och visas i ett eget block längst upp under dagen, utan timgräns
- För övriga events: max 3 per timme, välj de 3 mest relevanta för den här personen om fler finns.
- Ingen kommentar eller motivering per event
- Flerdags-events (de som har fler dagar i sitt "days"-fält) ska bara listas EN gång — under sin första dag. Skriv vilka övriga dagar de pågår i en parentes, t.ex. "(även tisdag–fredag)"
- Sortera på tid inom varje dag
- Skriv på svenska

FORMAT:

## [Dag datum]

### Hela dagen

**[start_time]-[end_time] [Titel]**
[Arrangör] — [event_type]
[url]

### Program

**[start_time] [Titel]**
[Arrangör] — [event_type]
[url]

(tom rad mellan events)

Avsluta hela programmet med cirka 3-6 meningar som förklarar hur du resonerat kring urvalet övergripande, om programmet som helhet, inte om personen.`,
      messages: [
        {
          role: "user",
          content: `QUIZ-SVAR:
Roll: ${state.role}
Officiell anledning: ${state.focusArea}
Hjärtefråga: ${state.passion}
Vill inte missa/slippa: ${state.preferences || "Inget specifikt"}
Dagar på plats: ${dayLabels}

EVENTS:
${JSON.stringify(selectedEvents)}`,
        },
      ],
    });

    // Create a ReadableStream that forwards text chunks
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                new TextEncoder().encode(event.delta.text)
              );
            }
          }
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Unhandled route error:", msg);
    return jsonError(msg);
  }
}

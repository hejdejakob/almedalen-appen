# Dataoperation: ämnesklassning 2026 (live DB)

**När:** 2026-06-22
**Vem/vad:** manuell körning (Claude Code) av `node map-topics.js` + `node build-aggregates.js`
**Varför:** 2026-programmet var satt men nyaste passen var oklassade — ämnestäckning 2026 låg på 86 % (419 pass utan `event_topics`), vilket gjorde ämnesvyn/ämnestrenderna ofullständiga för 2026.

## Vad som ändrades i Supabase (public-schemat)
- `event_topics`: upsertade 11 295 rader (deterministisk mappning `topic_pdf_original → topic_primary` via TOPIC_MAP i map-topics.js). Idempotent, ingen LLM.
- `arranger_stats`, `speaker_stats`, `topic_year_stats`: ombyggda av build-aggregates.js (samma som dagliga refreshen gör).

## Resultat
- 2026 ämnestäckning: 86 % → **100 %** (3 032/3 032).
- `topic_year_stats` innehåller nu fullständig 2026 → ämnesvyn (getTopicDetail) visar korrekt 2026.
- Kvar oklassat: en handfull pass med trasiga `topic_pdf_original` (scrape-fragment som "för", "tt").

## Ej gjort (kräver beslut)
- **Sentiment** (`event_sentiment`): 2026 ≈ 86 %. Kräver LLM (Anthropic Batch API) — kostar på Anthropic-nyckeln.
- **Sektor** (`arranger_classifications`): 2026 ≈ 81 % (443 arrangörer utan rad). Befintliga script träffar inte "saknar-rad"-fallet rent; kräver riktad körning.

## Notis
Klassningen ligger INTE i det dagliga launchd-jobbet (det hämtar program + bygger stats men kör inte map-topics/sentiment). Överväg att lägga in map-topics i refreshen så att ämnesgapet inte återkommer.

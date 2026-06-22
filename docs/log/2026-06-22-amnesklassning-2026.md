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

## Sentiment + sektor via SUBAGENTER (samma dag, ej API-nyckel)
Enligt Jakob: LLM-klassningen ska göras av **subagenter (Max-plan)**, inte den mätta Anthropic-API-nyckeln. Upplägg: subagenter (Workflow) gör bedömningen och skriver resultatfiler i `tmp/`, deterministiska node-script validerar och upsertar till DB.

- **Sentiment** (`event_sentiment`): 11 subagenter klassade 419 oklassade 2026-pass (score/label/urgency_score/framing). Validerade (alla 419, värden inom intervall) och upsertade. 2026: 86 % → **100 %**.
- **Sektor** (`arranger_classifications`): 6 subagenter klassade 443 arrangörer aktiva 2026 utan sektor (sektor ur de 10 befintliga + sub_sector + confidence, `method='subagent'`). Validerade och upsertade. 2026-arrangörer med sektor: 81 % → **100 %**.

## Slutläge 2026 (verifierat)
ämne 100 % · sentiment 100 % · arrangör-sektor 100 %. ⇒ 2026 kan nu tas in i trendsidorna (dashboard/galtan) utan att understattas.

## Notis
Klassningen ligger INTE i det dagliga launchd-jobbet (det hämtar program + bygger stats men kör inte map-topics/sentiment). Överväg att lägga in map-topics i refreshen så att ämnesgapet inte återkommer.

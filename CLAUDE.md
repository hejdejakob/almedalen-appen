# Almedalsdata — Projektbeskrivning för Claude

## Vad detta är

Ett datajournalistikprojekt som omvandlar rådata från Almedalsveckans kalendarier (2022–2026)
till analytiska visualiseringar och en säljbar kundprodukt. Primär målgrupp är politiska insiders
och organisationer som Reform Society jobbar med (TCO, IF Metall, Hyresgästföreningen m.fl.).

Projektet drivs av Jakob Ohlsson på Reform Society. Claude används som huvudverktyg för
kod, SQL, datapipeline, enrichment och rapportgenerering.

---

## Rådata — vad vi har

**Källor:**
- Web-scraper (färdig modul) — hämtar events från Almedalens webbkalendarium, 2025–2026
- PDF-parser (färdig modul) — extraherar och konverterar historiska PDF-kalendrar till CSV, 2022–2024
- Arrangörsnormalisering (färdig modul) — deduplicerar organisationsnamn

**CSV-schema från PDF-konverteringen (2022–2024):**
```
Rubrik, Dag, Ämne, Evenemangstyp, Plats, Arrangör, Medverkande, Beskrivning av samhällsfrågan, Event-ID
```

- `Ämne` är förklassificerat i PDF-data — spara som `topic_pdf_original`, använd som baseline
- `Arrangör` och `Medverkande` kan innehålla flera värden per cell — kontrollera separator
- `Event-ID` sparas som `source_id`, inte som primärnyckel i databasen

---

## Datamodell

Tre lager. Blanda aldrig lager — enrichment skriver aldrig till rådata-tabeller.

### Lager 1 — Rådata

```sql
events (id, source_id, year, title, description, start_time, end_time,
        location_name, lat, lng, event_type, topic_pdf_original,
        source, raw_text, created_at)

arrangers (id, name, name_normalized, org_number, website, first_seen_year)

speakers (id, name, name_normalized, title, org_name, first_seen_year)

event_arrangers (event_id FK, arranger_id FK, is_primary)

event_speakers (event_id FK, speaker_id FK, role, raw_mention)
```

### Lager 2 — Enrichment (Claude API-jobb, körs en gång per år)

```sql
arranger_classifications (arranger_id FK, sector, sub_sector, confidence,
                          method [claude|manual], verified_by)

event_topics (event_id FK, topic_primary, topic_secondary[], keywords[],
              confidence)

event_sentiment (event_id FK, score FLOAT -1..1, label [positiv|neutral|negativ],
                 urgency_score FLOAT 0..1, framing [problem|solution|neutral],
                 confidence)
```

### Lager 3 — Aggregat (förberäknat, uppdateras efter enrichment)

```sql
arranger_stats (arranger_id+year PK, events_count, panel_slots_given,
                panel_slots_received, agenda_power_index)

speaker_stats (speaker_id+year PK, panel_count, unique_arrangers,
               years_active, breadth_score)

topic_year_stats (topic+year PK, event_count, yoy_change_pct,
                  avg_sentiment, top_arrangers JSONB)
```

---

## Taxonomier — låsta, ändra inte mitt i körning

### Sektorer (10 st)

```
näringsliv            → bank_finans, försäkring, industri_tillverkning, handel,
                        tech_it, fastighet, energi, transport, läkemedel_life_science,
                        bygg_infrastruktur, livsmedel_jordbruk, övrigt_näringsliv
konsult_pr            → konsult, pr_kommunikation, advokatbyrå, eventbyrå,
                        rekrytering, analys_research
arbetsgivar_branschorg → arbetsgivarorganisation, branschförening
fackförbund           → lo_förbund, tco_förbund, saco_förbund, annat_fack
civilsamhälle         → folkrörelse_ideell, välgörenhet_ngo, patientorg,
                        lobbygrupp_kampanj, studieförbund, trossamfund
tänketank_stiftelse   → tänketank, stiftelse_fond
offentlig_sektor      → statlig_myndighet, region, kommun, riksdag_regering,
                        eu_internationell
parti                 → riksdagsparti, lokalt_parti, ungdomsförbund
media                 → dagstidning, public_service, branschmedia, digital_media
akademi               → universitet_högskola, forskningsinstitut
```

### Ämneskluster (21 st)

```
arbetsmarknad_löner, välfärd_omsorg, hälsa_sjukvård, skola_utbildning_forskning,
klimat_miljö_hållbarhet, energi, bostäder_samhällsbyggnad, transport_infrastruktur,
ekonomi_tillväxt, skatter_offentliga_finanser, näringsliv_innovation,
digitalisering_ai, försvar_säkerhet, demokrati_rättsstat,
integration_migration, eu_utrikespolitik, jämställdhet_mångfald,
media_kommunikation, kultur_idrott, barn_ungdom, övrigt
```

---

## Enrichment-pipeline — fyra jobb

Kör i denna ordning. Varje jobb är idempotent: WHERE enriched_at IS NULL.

### Jobb 1 — Sektorklassificering av arrangörer
- **Input:** {id, name} per arrangör, batchar om 30–50
- **Output:** arranger_classifications
- **Modell:** claude-haiku-4-5-20251001
- **Efterarbete:** Manuell granskning av rader med confidence < 0.8 (~50–80 st)

### Jobb 2 — Ämneskluster per event
- **Input:** {id, title, description} per event, batchar om 20–30
- **Output:** event_topics
- **Modell:** claude-haiku-4-5-20251001
- **OBS:** För PDF-data (2022–2024), kartlägg topic_pdf_original → kluster direkt
  utan API-anrop. Kör SELECT DISTINCT Ämne och mappa manuellt eller med ett
  enda Claude-anrop.

### Jobb 3 — Talare NER
- **Input:** {id, description} per event, batchar om 20
- **Output:** event_speakers + speakers
- **Modell:** claude-sonnet-4-6 (kräver mer precision än klassificering)
- **Efterarbete:** Speaker-dedup — normalisera namnvarianter med
  normaliseringsprompten (se nedan)

### Jobb 4 — Sentiment
- **Input:** {id, title, description} per event, batchar om 30–50
- **Output:** event_sentiment
- **Modell:** claude-haiku-4-5-20251001 (billigast)
- **Validering:** Kontrollera att fördelningen pos/neutral/neg per år ser rimlig ut

---

## Normalisering av namn (arrangörer och talare)

Separat steg innan och efter NER. Prompt hanterar organisationsnamn och personnamn.

**Regler:**
- Kanoniskt namn = officiellt fullständigt namn utan lokal/regional suffix
- Dotterbolag och moderbolag är OLIKA entiteter
- Confidence < 0.8 → lägg i flagged, slå inte ihop automatiskt
- Kör i batchar om max 100 namn
- Modell: claude-sonnet-4-6

---

## Den färdiga produkten — fem analytiska vyer

### 1. Makt & utrymme

**Agendakraft-index:** Bubbeldiagram där varje bubbla är en organisation.
Storlek = agendakraft-index (kombinerar: antal egna seminarier + panelplatser
givna till andra + egna talare i andras paneler). Visar vem som är sändare
vs mottagare i Almedalen.

**Sektorbalans över tid:** Staplad area-graf 2022→2026, normaliserad till 100%
per år. Visar om Almedalen blivit mer korporativt, mer fackligt eller mer
civilsamhällesdrivet.

**Visbykarta:** Karta över Visby innerstad med arenapositioner. Färgkod per sektor,
cirkelstorlek per antal seminarier. Visar geografisk maktfördelning — vem har
ringmurszonen vs utkanten.

### 2. Ämnen & trender

**Alluvial-flöde:** Sankey-diagram som visar hur ämnesblock förändras i volym
2022→2026. Smalare ström = ämnet krymper. Bredare = det växer. AI:s intåg
2024 syns som en ny bred flod.

**Trending topics:** Sparklines för alla 20 ämneskluster, sorterade efter
% förändring. Topp = starkast tillväxt, botten = starkast nedgång.
Klickbar för att se vilka aktörer som driver respektive ämne.

**Valårseffekt:** Jämförelsevy valår (2022, 2026) vs icke-valår. Vilka ämnen
ökar bara under valår? Vilka är evergreen?

### 3. Nätverk & talare

**Panelkartläggning:** Force-directed nätverksgraf. Noder = organisationer,
kanter = delade paneldeltaganden. Kantens tjocklek = frekvens. Kluster =
informella allianser. Brokers = noder med kopplingar till flera kluster.

**Arena-nätverksgraf:** Bipartit force-directed graf med två nodtyper:
arenor (större noder med streckad ring) och organisationer (mindre cirklar,
färgade per sektor). Kanter visar att en organisation arrangerat 2+ events
på arenan. Topp 30 arenor efter antal unika arrangörer. Venue-normalisering
via `ARENA_OVERRIDES` i `route.ts` mappar ~100 adressvarianter till ~50
kanoniska arenanamn (t.ex. "Donnersgatan 6" → "Hansaplatsen",
"Strandvägen 4.1" → "Dagens industris arena", "S:t Hansplan 2" → "Folkhälsodalen").

**A-listan:** Rankad talarlista med tre dimensioner: volym (antal paneler),
kontinuitet (antal år i rad), bredd (antal unika arrangörer). Visar
Almedalens evergreens vs debutanter.

### 4. Sentiment & ton

**Almedalens emotionella puls:** Årsvis sentiment-index som visar om Almedalen
blivit mer optimistiskt eller mer dystopiskt. Baserat på titlar + beskrivningar.

**Sektor-heatmap:** Sektorer på y-axeln, år på x-axeln. Färgskala mörkgrön
(positivt) → mörkröd (negativt). Visar om finanssektorn alltid är optimistisk
och om fackrörelsen driver kris-narrativet.

### 5. Almedalspegeln — BORTTAGEN

Kundspecifik positioneringsanalys (cosine similarity, white space, rivalanalys).
Togs bort eftersom de flesta aktörer har för få events (5–10 st) för att
analysen ska bli meningsfull.

---

## Fasplan

### Fas 0 — Klart
- [x] Web-scraper
- [x] PDF-parser → CSV
- [x] Arrangörsnormalisering (modul)
- [x] Datamodell designad
- [x] Taxonomier låsta (sektorer + ämneskluster)
- [x] Enrichment-prompts skrivna (4 st)
- [x] Normaliseringsprompt skriven

### Fas 1 — Databas och ingest — KLART
- [x] Skapa Supabase-projekt
- [x] Kör CREATE TABLE SQL för alla tabeller
- [x] Adaptera scraper-output till Supabase INSERT (upsert på year+source_id)
- [x] Adaptera PDF-CSV-ingest till samma schema
- [x] Ladda all data, verifiera radantal per år
- [x] Kör SELECT DISTINCT Ämne på PDF-CSVerna, mappa till 20 kluster manuellt

**Resultat:** 9 407 events (2022: 1 944, 2023: 1 981, 2024: 2 048, 2025: 2 290, 2026: 1 144)

### Fas 2 — Enrichment — KLART
- [x] Jobb 1: Sektorklassificering (3 081 arrangörer klassificerade)
- [x] Jobb 2: Ämneskluster (9 407 events)
- [x] Jobb 3: Talare/medverkande
  - 2022–2024: Parsade `participants`-fältet från PDF-data (agent-parsning)
  - 2025: Scrape av `persons` (medverkande) + `contactPerson` från eventdetalj-sidor
  - 2026: Kontaktpersoner inlästa (medverkande scrapad när programmet är klart)
- [x] Jobb 4: Sentiment (9 407 events)
- [x] Aggregat-tabeller (arranger_stats, speaker_stats, topic_year_stats)

**Resultat:** 16 509 unika talare, 40 257 event-speaker-kopplingar, 24 201 speaker_stats-rader.
Snitt talare/event: 2022: 4.3, 2023: 4.6, 2024: 4.9, 2025: 5.2, 2026: 0.7 (bara kontaktpersoner).
Org-namn-som-talare rensade (492 felaktiga poster borttagna).

**Enrichment gjordes med Claude Code-agenter (inte API-credits) — Haiku för parsning, Sonnet för granskning.**

### Talaruppdatering — mars 2026
- [x] Uppdaterade titlar och organisationer för A-listans 489 talare (topp 50 per kategori)
- [x] Websökning via Sonnet-subagenter (10 parallella) för alla 489 personer
- [x] 371 talare fick uppdaterade titlar/organisationer, 118 oförändrade, 0 fel
- **Script:** `export-a-listan-speakers.js` (export), `restore-and-update-speakers.js` (uppdatering)
- **Temporära filer:** `tmp/speakers-*-updated.json` (websökta resultat per kategori)
- **Exempel på korrigeringar:** Mikael Damberg (finansminister → riksdagsledamot S),
  Acko Ankarberg Johansson (sjukvårdsminister → landshövding Västmanlands län),
  Michael Claesson (C INS → Överbefälhavare), PM Nilsson (DI → VD Timbro)

### Fas 3 — Visualiseringar — KLART
- [x] Makt-dashboard (bubbeldiagram + area-graf)
- [x] Ämnes-dashboard (alluvial + sparklines + valårseffekt)
- [x] Nätverksgraf (force-directed, topp 80 arrangörer, 300 kopplingar)
- [x] Sentiment-dashboard (puls + heatmap)
- [x] Visbykarta (Leaflet, 149 geocodade platser, 73% täckning)
- [x] Arena-nätverksgraf (bipartit D3-graf: arenor + organisationer, kopplingar via events)

**Resultat:** Sex analytiska vyer i `app/dashboard/page.tsx` med API i `app/api/dashboard/route.ts`.
Vyer: `stats`, `topics`, `sectors`, `power`, `sentiment`, `speakers`, `network`, `locations`, `arena-network`, `topic-detail`.
Komponenter: `SankeyChart.tsx`, `NetworkGraph.tsx`, `VisbyMap.tsx`, `ArenaNetwork.tsx`.
Geocodning: `geocode-venues.js` → `public/venue-coordinates.json` (149 platser, 6 872 av 9 407 events).
Kartan använder Leaflet + CartoDB-tiles, CircleMarkers med sektorfärg och sqrt-skalad radie.

### Fas 3b — Talarsida med fyra flikar — KLART
- [x] Talarsök — sök bland 16 509 talare med debounced search + AbortController
- [x] Talarkollen — kurerade listor (Rising Stars, Evergreens, Hög Bredd) med ämnesfilter
- [x] Ämnessök — 21 ämneskluster som kort → klicka för topptalare, toppaktörer, sektorfördelning
- [x] Aktörssök — sök organisationer → aktörsprofil med ämnen, talare, agenda power
- [x] Korsnavigering — klicka talare/aktör/ämne från valfri flik öppnar rätt vy
- [x] `/talarkollen` redirectar till `/speakers?tab=talarkollen`

**Resultat:** Samlad talarsida i `app/speakers/page.tsx` med fyra flikar.
API:er: `/api/speakers` (talarsök + profil + eventdetalj), `/api/arrangers` (aktörssök + profil),
`/api/dashboard?view=speaker-guide` (kurerade listor), `/api/dashboard?view=topic-detail` (ämnesdetalj).
URL-params: `?tab=talarkollen`, `?tab=amnen`, `?tab=aktorer`, `?tab=amnen&topic=slug`, `?tab=aktorer&id=N`.

### Fas 4 — Almedalspegeln — BORTTAGEN
Implementerades fullt ut men togs bort — de flesta aktörer har för få events (5–10 st)
för att per-aktör-analysen ska bli intressant. Koden (cosine similarity, white space,
rivalanalys, rapport-generator) raderades.

---

## Teknisk stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript 5
- **Styling:** Tailwind CSS 4
- **Databas:** Supabase (Postgres) via @supabase/supabase-js
- **Enrichment:** Claude Code-agenter (Haiku för parsning/klassificering, Sonnet för granskning)
- **AI SDK:** @anthropic-ai/sdk
- **Batch-runner:** Node.js-scripts + Claude Code subagenter
- **Scraping:** Playwright (eventdetalj-sidor för medverkande + kontaktpersoner)
- **Modeller:** claude-haiku-4-5-20251001 (klassificering/sentiment/parsning),
  claude-sonnet-4-6 (granskning, rapport)
- **Visualisering:** React + Chart.js 4 + react-chartjs-2 + D3 7 (alluvial via d3-sankey, nätverksgraf, arenanätverk)
- **Karta:** Leaflet + react-leaflet + CartoDB light tiles
- **Markdown:** marked
- **Repo:** github.com/reform-society/almedalen-appen (privat)
- **Estimerad API-kostnad:** < 10 USD totalt för enrichment av ~4 000 events

---

## Viktiga designprinciper

1. **Spara alltid raw_text** — möjliggör re-parsning om pipelinen förbättras
2. **Enrichment är separata tabeller** — rådata rörs aldrig av API-jobben
3. **Taxonomin är låst** — ändra inte klusternamn efter att enrichment körts
4. **Idempotens** — alla jobb kör mot WHERE enriched_at IS NULL
5. **Confidence-flaggning** — < 0.8 hamnar i review-kö, slås aldrig ihop automatiskt
6. **Arrangörsnormalisering är grunden** — allt nätverks- och maktanalys
   förutsätter att samma organisation är samma entitet varje år

# Ämnessök + Aktörssök — Designspec

## Syfte

Utöka `/speakers`-sidan med två nya flikar: **Ämnessök** och **Aktörssök**. Användaren ska kunna utforska Almedalsdata utifrån ämnen ("vem driver klimatfrågan?") och organisationer ("vad gör TCO i Almedalen?"). Alla vyer korsrefererar varandra via klickbara talare, aktörer och ämnen.

## Flikstruktur

Fyra flikar i `/speakers`, scrollbara horisontellt på mobil:

| Flik | URL-param | Syfte |
|------|-----------|-------|
| Talarsök | (default) | Sök individer |
| Talarkollen | `?tab=talarkollen` | Kurerade listor |
| Ämnessök | `?tab=amnen` | Utforska per ämne |
| Aktörssök | `?tab=aktorer` | Sök organisationer |

## Ämnessök

### Landning: Ämneskort

Visa alla 21 ämneskluster som klickbara kort i ett grid. Varje kort visar:
- Ämnesnamn
- Totalt antal events (summerat alla år)
- Trend-indikator (YoY-förändring senaste året, pil upp/ner + procent)

Sorterat efter totalt event-antal (störst först). Ingen sökfunktion behövs — 21 ämnen ryms i ett grid.

### Ämnesdetalj

Klicka ett ämne → visa i samma vy (inga nya routes):

- **Tillbaka-knapp** → åter till ämnesgridet
- **Rubrik:** Ämnesnamn + totalt antal events
- **Trendgraf:** Events per år (2022–2025), enkel stapelgraf
- **Topptalare** (10 st): Talare med flest paneler inom detta ämne. Visar namn, titel, org, antal paneler i ämnet. Klickbar → öppnar talarprofil (befintlig ProfileView).
- **Toppaktörer** (10 st): Arrangörer med flest events inom ämnet. Visar namn, sektor (färgprick), antal events i ämnet. Klickbar → öppnar aktörsprofil (ny, se nedan).
- **Sektorfördelning:** Enkel horisontell bar som visar vilka sektorer som driver ämnet.

### API

Ny vy: `GET /api/dashboard?view=topic-detail&topic={topic_slug}`

Query:
- Joina `event_topics` + `event_speakers` + `speakers` + `speaker_stats` → topptalare
- Joina `event_topics` + `event_arrangers` + `arrangers` + `arranger_classifications` → toppaktörer
- Använda `topic_year_stats` → trenddata + sektorfördelning

Response:
```json
{
  "topic": "klimat_miljö_hållbarhet",
  "totalEvents": 842,
  "perYear": [{ "year": 2022, "count": 180 }, ...],
  "topSpeakers": [{
    "id": 123,
    "name": "...",
    "title": "...",
    "org": "...",
    "category": "...",
    "eventCount": 15
  }, ...],
  "topArrangers": [{
    "id": 456,
    "name": "...",
    "sector": "...",
    "eventCount": 28
  }, ...],
  "sectorBreakdown": [{ "sector": "civilsamhälle", "count": 120 }, ...]
}
```

## Aktörssök

### Landning: Sök + toppaktörer

- **Sökfält** (debounced, med AbortController som i talarsöket)
- **Default:** Grid med mest aktiva arrangörer (topp 30 efter events_count)
- Varje kort visar: namn, sektorfärg-badge, antal events, antal år aktiv

### Sökresultat

Samma grid-kort som default men filtrerat på söksträngen. Sök via ILIKE på `arrangers.name` + `arrangers.name_normalized`.

### Aktörsprofil

Klicka en aktör → visa i samma vy:

- **Tillbaka-knapp** → åter till sökning
- **Rubrik:** Organisationsnamn + sektorbadge
- **Statistik-kort:** Events totalt, år aktiv, agenda power index
- **Events per år:** Sparkline/stapelgraf (2022–2025)
- **Deras ämnen:** Topp-5 topics som aktören arrangerar events om (med antal). Klickbara → öppnar ämnesdetalj.
- **Deras talare:** Topp-10 talare som aktören bjudit in (efter antal gemensamma events). Klickbara → öppnar talarprofil.

### API

Ny endpoint: `GET /api/arrangers`

Query-parametrar:
- `q` (string) — sök på namn
- `id` (number) — hämta aktörsprofil
- `limit` (number, default 30, max 100)

**Sök-response:**
```json
{
  "arrangers": [{
    "id": 456,
    "name": "TCO",
    "sector": "fackförbund",
    "totalEvents": 87,
    "yearsActive": 4
  }, ...]
}
```

**Profil-response (id=N):**
```json
{
  "arranger": {
    "id": 456,
    "name": "TCO",
    "sector": "fackförbund",
    "subSector": "tco_förbund",
    "totalEvents": 87,
    "agendaPower": 12.4
  },
  "perYear": [{ "year": 2022, "events": 20, "panelSlotsGiven": 45 }, ...],
  "topTopics": [{ "topic": "arbetsmarknad_löner", "count": 32 }, ...],
  "topSpeakers": [{
    "id": 123,
    "name": "...",
    "title": "...",
    "org": "...",
    "category": "...",
    "sharedEvents": 8
  }, ...]
}
```

## Korsreferenser

Alla vyer delar samma navigationslogik:
- Klicka talare → `openProfile(id)` (befintlig ProfileView)
- Klicka aktör → `openArrangerProfile(id)` (ny ArrangerProfileView)
- Klicka ämne → `openTopic(slug)` (ny TopicDetailView)
- Tillbaka-knappar returnerar till rätt flik och undervy

## Styling

Följ befintlig design i speakers-sidan:
- Kort med `border: 2px solid #000`, `boxShadow: 3px 3px 0 #000`, hover-effekt
- Sektorfärger från befintliga `SECTOR_COLORS`
- `#ff6632` som accent
- `var(--font-formula)` för rubriker
- `#f7f5e4` bakgrund

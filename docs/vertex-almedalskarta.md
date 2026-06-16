# Vertex — Almedalskarta 2026

**Status:** Live i produktion · **Uppdaterad:** 2026-06-16
**Live:** https://almedalsdata.se/vertex (publik, `noindex`, ogatad — utanför `middleware.ts`-matchern, som `/better-shelter` och `/sakerhetsarenan`)
**Kund:** Vertex Pharmaceuticals (svensk public affairs via Reform Society)

En avgränsad, klientfärdig kundvy: en prioriteringskarta över Almedalsveckans 2026-seminarier
inom Vertex sakområden, så att kunden kan planera sin närvaro i Visby. Bygger på almedalen-appens
befintliga eventdata (Supabase `events` + `event_topics` + `event_arrangers` + `event_speakers`).

## Vad sidan innehåller

- **28 kuraterade seminarier** i två lager: **9 prioritera** (rena fullträffar) + **19 bevaka** (penumbra).
- **5 teman:** särläkemedel & finansiering · ATMP/gen- & cellterapi · sällsynta diagnoser & strategi · screening (CF & cancer) · access/pris & precisionsmedicin.
- Per pass: dag/tid/plats/arrangör + **rekommenderad åtgärd** (delta / sök talarplats / boka arrangörsmöte / bevaka) + **vinkel "varför för Vertex"**.
- **Konkurrent-intel:** pass som arrangeras av konkurrerande läkemedelsbolag märks "Konkurrent arrangerar · spaning" (14 st). Reform Societys egna pass märks separat.
- **Visbykarta** (leaflet) med de prioriterade passen.
- **62 nyckelpersoner** i fyra kategorier med olika syfte: **politiker** (träffa), **tjänstemän/beslutsfattare** (TLV, NT-rådet m.fl. — förstå/träffa), **patientledare** (allierade), **konkurrenter** (spaning, ej möten).

## Filkarta

```
app/vertex/page.tsx        Serverkomponent. Läser source/vertex_*.json + venue-koordinater. force-static, noindex.
app/vertex/VertexView.tsx  Serverkomponent. All markup (header, karta-sektion, prioritera, bevaka per tema, personer, footer).
app/vertex/VertexMap.tsx   Klient-ö ('use client') — enda klientdelen, dynamisk import av ScheduleMap (leaflet).
source/vertex_seminars.json  Slutlig seminariedata (committas). Genererad.
source/vertex_people.json    Slutlig persondata (committas). Genererad.
scripts/vertex/build_vertex.py  Bygg-script. KURERINGEN bor här (CUR-dict + PHARMA-lista + personkategori-overrides).
tmp/vertex/                 Mellanfiler (gitignorerat): candidate_seminars.json, candidate_people.json, verify_payload.json.
```

Brand: Reform Society (svart header, orange `#fb531a`, cremebakgrund `#f7f5e4`, Formula Condensed-rubriker,
Space Mono, skarpa hörn + hårda skuggor). Variabler i `app/globals.css` / `app/layout.tsx`.

## Uppdatera datan / deploya

```bash
cd /Users/jakobohlsson/almedalen-appen
# 1. (vid behov) regenerera kandidatlistor från Supabase — se "Hur kandidaterna togs fram" nedan.
# 2. bygg om slutdatan från kureringen:
python3 scripts/vertex/build_vertex.py        # → source/vertex_seminars.json + vertex_people.json
# 3. bygg + deploya:
npm run build && npx vercel --prod --yes      # alias: almedalsdata.se/vertex
```

För att ändra urval/vinklar/teman: redigera `CUR`-dicten i `scripts/vertex/build_vertex.py`
(nyckel = `event_id`, värde = `(tema, tier, åtgärd, vinkel)`), kör build + deploy.

## Hur kandidaterna togs fram (metod)

1. **Sökning** över alla **2 987** 2026-event i `events`: nyckelords- och arrangörsmatchning
   (särläkemedel, ATMP, gen-/cellterapi, CRISPR, sällsynt, screening, cystisk fibros, precisionsmedicin,
   TLV/NT-rådet, life science m.fl.) med falskträff-filter (t.ex. "sällsynta jordartsmetaller", gräns-"screening").
   → 93 kandidater (17 kärna + 76 penumbra) + 104 återkommande personer. (Engångskod, ej committad pipeline.)
2. **Kurering** redaktionellt i `CUR`-dicten (urval, tema, tier, åtgärd, vinkel).
3. **Adversariell verifiering** — tre oberoende granskaragenter (relevans-skeptiker, vinkel-korrekthet,
   tema/konkurrent-korrekthet) granskade `tmp/vertex/verify_payload.json`. Resultat: drog 5 irrelevanta,
   nedgraderade 3 från prioritera till bevaka, mjukade upp 2 överdrivna vinklar. → slutliga **28**.
4. **Korrekturläsning** (svensk): tankstreck ur löptext, anglicismer försvenskade, sär-/bindestreck uppstädat.

## Vertex sakkontext (så slipper man re-researcha)

- **Cystisk fibros:** Kaftrio/Kalydeco (förmån 2022 efter sidoöverenskommelse), **Alyftrek** (CHMP positivt 2025) på väg till TLV/NT-rådet.
- **Casgevy** (exa-cel, första CRISPR-genterapin, mot sicklecellanemi & beta-talassemi) — ATMP/genterapi för sällsynta. **Status SE: NT-rådet "avvakta"** i väntan på TLV:s hälsoekonomi. Det levande ATMP-finansieringstestet.
- **Vertex svenska policyintressen:** betalningsmodeller för dyra ATMP/särläkemedel (TLV, NT-rådet, ordnat införande), nationell strategi för sällsynta hälsotillstånd (450 mkr/år 2026–28), nyföddhetsscreening (särskilt CF), precisionsmedicin/genomik, jämlik tillgång.
- **INTE Vertex kärnområde:** obesitas, migrän, hjärt-kärl, vaccin, tandvård (de finns i bevaka-lagret bara där access/system-vinkeln bär).

## Öppna punkter / varningar

- **Personkategoriseringen är ett första-pass** (regelbaserad gissning + handpåläggning på topparna i `build_vertex.py`). "Tjänstemän"-bucketen kan innehålla någon felklassad regionpolitiker. Bör granskas innan slutleverans — kan köras genom samma adversariella verifiering som seminarierna.
- **Snapshot:** programmet kan ändras fram till veckan; kör om build + deploy för att uppdatera.
- **Kartkoordinater:** löses i `page.tsx` mot `public/venue-coordinates.json` via (1) exakt platssträng i en `locations`-array, annars (2) *första kommasegmentet* som basnyckel. Saknas nyckeln får passet `lat/lng = null` och faller bort från kartan. 2026-06-16: 6 prioriterade pass saknade nyckel (S:t Hansplan, Strandgatan 34, Visborgsgatan 5, Strandgatan 15B, Hamnplan 2, Hästgatan 13) → lades in (5 fanns redan under längre nycklar, Visborgsgatan 5/SwedenBIO geokodades nytt via OSM/hitta.se). Nu placeras alla 9 (7 markörer; Life Science-dagen-passen klustrar på Hamnplan). Kartans räknare visar rätt nämnare via `total`-prop på `ScheduleMap`.
- **Inga namngivna Vertex-personer** är inlagda (sidan är ämnes-/seminariedriven). Kan läggas till med eget schema likt `/better-shelter` om kunden skickar vilka som kommer.
- Sidan är **publik** (vem som helst med URL:en når den), oindexerad. Vill man gata den: lägg `/vertex` i `middleware.ts`-matchern.

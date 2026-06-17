# Eli Lilly — Almedalskarta 2026

**Status:** Live i produktion · **Uppdaterad:** 2026-06-17
**Live:** https://almedalsdata.se/eli-lilly (publik, `noindex`, ogatad — utanför `middleware.ts`-matchern, som `/vertex` och `/better-shelter`)
**Kund:** Eli Lilly Sverige (svensk public affairs via Reform Society)

En avgränsad, klientfärdig kundvy byggd på exakt samma mönster som `/vertex`: en prioriteringskarta
över Almedalsveckans 2026-seminarier inom Eli Lillys två stora sakområden — **obesitas** och
**Alzheimer** — så att kunden kan planera sin närvaro i Visby. Bygger på almedalen-appens
befintliga eventdata (Supabase `events` + `event_arrangers` + `event_speakers`).

## Vad sidan innehåller

- **22 kuraterade seminarier** i två lager: **9 prioritera** + **13 bevaka**.
- **5 teman:** obesitas & läkemedel · prevention & folkhälsa · Alzheimer & demensvård · tidig diagnos & hjärnhälsa · access/pris & ordnat införande.
- Per pass: dag/tid/plats/arrangör + **rekommenderad åtgärd** (delta / sök talarplats / boka arrangörsmöte / bevaka) + **vinkel "varför för Lilly"**.
- **Konkurrent-intel:** **Novo Nordisk äger obesitas-scenen** — bolaget arrangerar 7 av veckans obesitas-pass (Birgers gränd 7/9). Dessa märks "Konkurrent arrangerar · spaning" (10 pass totalt, inkl. Roche/BioArctic/Eisai på Alzheimer-sidan).
- **Eli Lillys egna pass** (2 st, Folkhälsodalen/S:t Hansgatan 18) märks separat.
- **Visbykarta** (leaflet) med de prioriterade passen.
- **12 nyckelpersoner** i fyra kategorier: politiker · tjänstemän/beslutsfattare (TLV:s GD Magnus Thyberg m.fl.) · patientledare (Jenny Vinglid, Riksförbundet Obesitas Sverige/HOBS m.fl.) · konkurrenter (Novo Nordisks Michaela Lydecker).

## Filkarta

```
app/eli-lilly/page.tsx          Serverkomponent. Läser source/eli_lilly_*.json + venue-koordinater. force-static, noindex.
app/eli-lilly/EliLillyView.tsx  Serverkomponent. All markup (kopia av VertexView med Lilly-teman/copy).
app/eli-lilly/EliLillyMap.tsx   Klient-ö ('use client') — dynamisk import av ScheduleMap (leaflet), delad med /vertex.
source/eli_lilly_seminars.json  Slutlig seminariedata (committas). Genererad.
source/eli_lilly_people.json    Slutlig persondata (committas). Genererad.
scripts/eli_lilly/build_eli_lilly.py  Bygg-script. KURERINGEN bor här (CUR-dict + COMPETITORS + people-kategorier).
tmp/eli_lilly/                  Mellanfiler (gitignorerat): candidate_seminars.json, candidate_people.json, verify_payload.json.
```

Brand: Reform Society (svart header, orange `#fb531a`, cremebakgrund `#f7f5e4`, Formula Condensed-rubriker,
Space Mono, skarpa hörn + hårda skuggor) — identiskt med `/vertex`.

## Uppdatera datan / deploya

```bash
cd /Users/jakobohlsson/almedalen-appen
# 1. (vid behov) regenerera kandidatlistor från Supabase — engångs-discovery-script (ej committat).
# 2. bygg om slutdatan från kureringen:
python3 scripts/eli_lilly/build_eli_lilly.py     # → source/eli_lilly_seminars.json + eli_lilly_people.json
# 3. bygg + deploya:
npm run build && npx vercel --prod --yes         # alias: almedalsdata.se/eli-lilly
```

För att ändra urval/vinklar/teman: redigera `CUR`-dicten i `scripts/eli_lilly/build_eli_lilly.py`
(nyckel = `event_id`, värde = `(tema, tier, åtgärd, vinkel)`), kör build + deploy.

## Hur kandidaterna togs fram (metod)

1. **Sökning** över alla 2 995 2026-event i `events`: nyckelords-matchning på obesitas (obesitas, fetma, övervikt,
   viktminskning, GLP-1, tirzepatid/semaglutid, Mounjaro/Wegovy/Ozempic m.fl.) och Alzheimer (alzheimer, demens,
   kognitiv, hjärnhälsa, lecanemab/donanemab/Leqembi/Kisunla). → 24 kandidater.
2. **Kurering** redaktionellt i `CUR`-dicten (urval, tema, tier, åtgärd, vinkel), informerad av faktagranskad research (se sakkontext).
3. **Uteslutet** (utanför Lillys kärna): 36152 (djurförsök/möss i Alzheimerforskning) och 36517 (NPF/barn-hjärnhälsa).

## Eli Lilly sakkontext (verifierad juni 2026 — så slipper man re-researcha)

**Produkter (rätt namn!):** Lillys tirzepatid heter i Sverige **Mounjaro** (Zepbound är USA-namnet — använd inte).
Lillys Alzheimer-läkemedel är **Kisunla (donanemab)**. ⚠️ **Leqembi (lecanemab) är Eisai/Biogens** (svensk forskning via BioArctic) — INTE Lillys.

**Obesitas:**
- Socialstyrelsens riktlinjer (2023) klassar obesitas som **kronisk sjukdom**, men GLP-1/GIP mot fetma ingår **inte** i högkostnadsskyddet (juni 2026).
- **TLV sa nej till Wegovy** (Novo Nordisk) i högkostnadsskyddet för obesitas, beslut 19 feb 2026 (ikraft 24 feb), vuxna + ungdomar 12–18. Skäl: risk för "subventionsglidning". Novo har överklagat.
- Lillys **Mounjaro subventioneras vid typ 2-diabetes men inte vid obesitas** — patienter betalar själva (flera tusen kr/mån). GLP-1 köps för ca 1,2 mdr kr/år utanför förmånen.
- Konkurrent: **Novo Nordisk** (Wegovy/Ozempic, semaglutid). Patientorg: **Riksförbundet Obesitas Sverige (tidigare HOBS)**, GS Jenny Vinglid.

**Alzheimer:**
- **Kisunla (donanemab, Lilly):** EU-godkänt **25 sep 2025** (CHMP-positivt 25 jul 2025 efter ett initialt nej i mars 2025). Sverige: **NT-rådet "avvakta" 15 okt 2025**; TLV:s hälsoekonomiska bedömning pågår (ej klar juni 2026). Ej infört i offentlig vård.
- **Leqembi (lecanemab, Eisai/Biogen):** EU-godkänt 16 apr 2025. Sverige: **NT-rådet AVRÅDDE regionerna 17 apr 2026** (ej kostnadseffektivt; ~3,7–4,2 mkr/QALY).
- Kärnfrågan är **pris/kostnadseffektivitet och ordnat införande**, inte godkännande. Tidig biomarkörbekräftad diagnos (blodtest **p-tau217**), infusions- och MR-kapacitet (ARIA) samt ApoE4-genotypning är flaskhalsar.

**Fallgropar (undvik):** kalla inte läkemedlen "förbjudna/ej godkända" (de ÄR EU-godkända — det är offentligt *införande* som stoppats); tillskriv inte Lilly Leqembi; säg inte att Mounjaro fick TLV-beslutet (det var Wegovy); använd inte "genombrott/bot" (anti-amyloid *bromsar*); kritisera inte TLV/NT-rådet frontalt — vinkeln är "utveckla systemet".

## Öppna punkter / varningar

- **Detta är ett första utkast** ("mest en idé") byggt på Vertex-mallen. Urval, vinklar och kategorisering bör granskas innan klientleverans — gärna genom samma adversariella verifiering som Vertex-seminarierna.
- **Personlagret är tunt** (12 personer) eftersom kandidatsetet är litet (24 event). Kan breddas eller köras genom verifiering.
- **Konkurrent-tunghet:** obesitas-debatten i Almedalen domineras av Novo Nordisk (7 pass). Det är en strategisk poäng i sig (var Lilly har "white space" och var det bara är spaning).
- **Snapshot:** programmet kan ändras fram till veckan; kör om build + deploy.
- **Lösenordsgrind:** sidan visar samma klient-overlay som `/vertex` (innehållet renderas bakom). Lämnad som den är enligt beslut.
- **Kartkoordinater:** 8 nya venyer lades in i `public/venue-coordinates.json` (Birgers gränd 7/9 = Novo Nordisks venue, Tage Cervins gata 1, S:t Hansgatan 18, S:t Hansplan 2, Hamnplan 5, Donnersplats, Donnersgatan 1). Alla 9 prioriterade placeras nu (8 markörer).

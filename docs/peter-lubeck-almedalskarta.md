# Peter Lübeck / Game Habitat — Almedalskarta 2026

**Status:** Live i produktion · **Uppdaterad:** 2026-06-21
**Live:** https://almedalsdata.se/peter-lubeck (publik, `noindex`, ogatad — utanför `middleware.ts`-matchern, som `/vertex` och `/eli-lilly`)
**Mottagare:** Peter Lübeck, VD och medgrundare Game Habitat (Malmö)

Avgränsad kundvy på samma mall som Vertex/Eli Lilly, men **anpassad**: spinnar kring Peter Lübecks
huvudsyfte — att driva en **nationell strategi för dataspel** och, i förlängningen, ett **svenskt
dataspelsinstitut**. Inte ett katalogiserande av SpelAlmedalen, utan Peters påverkansplan för veckan.

## Vad sidan innehåller

- **"Läget i frågan"-box:** frågan är politiskt låst (riksdagen avslog senast i KrU6, beslut 1 april 2026; regeringen hänvisar till KKN-strategin) → Almedalen mitt i valrörelsen = fönstret. Region Skånes institutsförstudie (okt 2024) föreslår Skåne-placering = hemmaplan. Omframning: 73-miljarders exportnäring, inte "spel som kultur".
- **Battle-map:** SpelAlmedalen-navet (Strandgatan 1b, en markör "8") + **5 🎯-nålar** för var kultur-/näringsminister-kandidaterna syns i övriga Visby (Wiechel @ Bredgatan 10, Lind @ Strandvägen 4.2, Olovsson @ Hamngatan 3, Ådahl @ S:ta Katarinagatan 6, Tsouplaki @ Donners plats 1).
- **8 prioritera + 9 bevaka** SpelAlmedalen-pass med Peter-vinklar. Spinnpass: **24946 "Kulturpolitik för det svenska spelundret"** (ons, med Mats Berglund, MP).
- **Påverkansunderlag (26 personer) i fem grupper** (enligt kund: inriktat på minister-kandidater):
  - **Kulturminister-kandidater (4):** Björn Wiechel (S), Amanda Lind (MP), Catarina Deremar (C), Parisa Liljestrand (M, sittande).
  - **Näringsminister-kandidater (4):** Fredrik Olovsson (S), Anders Ådahl (C), Janine Alm Ericson (MP), Ebba Busch (KD, sittande).
  - **Extra intresserade / dataspels-vänner (8):** Rickard Nordin (C, institutsmotionär), Mats Berglund (MP), Peter Ollén (M), Sofia Skönnbrink (S), Anne-Li Sjölund (C), Vasiliki Tsouplaki (V), Alexander Christiansson (SD), Lars Mejern Larsson (S).
  - **Allierade & ekosystem (7):** Per Strömbäck/Dataspelsbranschen, Sverok, Uppsala universitet (speldesign), Svenska Spelforskarrådet, Region Skåne, SCORE-klustren.
  - **Myndigheter (3):** Tillväxtverket, Kulturdepartementet, Kulturrådet.

## Filkarta

```
app/peter-lubeck/page.tsx           Serverkomponent. Läser source/peter_lubeck_*.json + venue-koordinater.
app/peter-lubeck/PeterLubeckView.tsx  All markup (5 personkategorier, läget-box, battle-map, inga konkurrenter).
app/peter-lubeck/PeterLubeckMap.tsx   Klient-ö, delad ScheduleMap (leaflet).
source/peter_lubeck_seminars.json   Genererad (core/watch + target-nålar med inline-koordinater).
source/peter_lubeck_people.json     Genererad (handsatt, verifierat påverkansunderlag).
scripts/peter_lubeck/build_peter_lubeck.py  Kurering: CUR (seminarier) + TARGETS (kartnålar) + PEOPLE.
tmp/peter_lubeck/spel_events.json   Mellanfil (gitignorerat): live SpelAlmedalen-event.
```

## Anpassningar mot pharma-mallen

- **Ingen "konkurrent · spaning"-ruta** — branschen är "kompisar med alla" (klustermodell, SCORE-samarbete). Ersatt av allierade + politiker.
- **Karta = battle-map.** Alla SpelAlmedalen-pass ligger på ETT nav (Strandgatan 1b), så kartan kompletteras med målpolitikernas venyer (deras koordinater ligger inline i TARGETS).
- **Personurval inriktat** (enligt kund) på kandidater till kultur- och näringsminister + kultur-/näringstalespersoner för C/S/MP, plus dataspels-vänner tvärs partierna.

## Verifierad sakkontext (juni 2026)

- **Politiskt läge:** nationell strategi + dataspelsinstitut avslaget i riksdagen upprepat (KrU4 feb 2025, KrU6 1 april 2026). S/V/MP:s utskottsinitiativ om statlig utredning föll. Regeringen hänvisar till KKN-strategin (skr. 2023/24:111).
- **Institutsförslaget:** Region Skånes förstudie "Ett nationellt spelinstitut – i Skåne" (5 okt 2024), Filminstitutet-modell, Skåne-placering.
- **Bransch:** Spelutvecklarindex 2025 — 36,8 mdr kr i Sverige (73 mdr inkl. utländska dotterbolag), 9 130 anställda; budskap "spelundret hotas trots rekordår".
- **Game Habitat:** ideell klusterorg (Skåne/Blekinge), Peter Lübeck VD/medgrundare. Ej kärnarrangör av SpelAlmedalen (det är Uppsala univ + Spelforskarrådet + Sverok + Dataspelsbranschen). SCORE: 5 kluster, Tillväxtverket 13,4 mkr, 2025–28.
- **Partiroller verifierade:** Wiechel S-kulturtalesperson (sedan hösten 2025), Olovsson S-näringstalesperson, Ådahl C-näringstalesperson (dec 2025), Deremar C-kulturtalesperson, Rickard Nordin = **Centerpartiet** (inte SD).

## Öppna punkter

- **Första utkast på kundens idé.** Urval och vinklar kan finslipas.
- **Spel ≠ spel om pengar:** "Vad händer inom spelpolitiken" (Svenska Spel, Strandgatan 35) uteslöts som gambling, men Berglund/Tsouplaki/Sjölund sitter där — noterat i deras profiler.
- **SpelAlmedalen-passen saknar exakta lokal-rumsnummer** men har dag/tid; navet är Strandgatan 1b.
- **Lösenordsgrind:** samma klient-overlay som övriga kundvyer (innehåll renderas bakom). Lämnad som den är.

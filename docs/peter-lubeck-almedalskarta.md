# Peter Lübeck / Game Habitat — Almedalen 2026

**Status:** Live i produktion · **Uppdaterad:** 2026-06-22 (ombyggd, v2)
**Live:** https://almedalsdata.se/peter-lubeck (publik, `noindex`, ogatad — utanför `middleware.ts`-matchern, som `/better-shelter`)
**Mottagare:** Peter Lübeck, VD och medgrundare Game Habitat (Malmö)

Kundvy på **Better Shelter-mallen (personvy + rekommenderade pass)** — inte Vertex/Eli Lilly-ämneskartan.
V1 var en SpelAlmedalen-katalog (allt Peter redan kan) och dög inte. V2 vänder på det: vilka
**beslutsfattare** Peter behöver träffa för att driva en nationell strategi + dataspelsinstitut, var de är
hela veckan, och en handfull pass **utanför spelbubblan** att synas på.

## Vad sidan innehåller
- **Karta** ("Var dina målpersoner är") — en markör per pass där en målperson medverkar.
- **Personer att träffa (14)** — kultur-/näringsministerkandidater + de mest dataspels-engagerade ledamöterna tvärs partierna, var och en med **hela sitt 2026-schema** (dag/tid/plats/arrangör). Inkl. Mats Berglund (MP), Rickard Nordin (C), Björn Wiechel (S), Amanda Lind (MP), **Alice Bah Kuhnke (MP)**, **Lawen Redar (S)**, Tsouplaki (V), Sjölund (C), Deremar (C), Olovsson (S), Ådahl (C), Per Strömbäck (Dataspelsbranschen). Parisa Liljestrand (M) och Peter Ollén (M) listas som "ej i programmet — sök möte separat".
- **Rekommenderade pass för Peter (10)** — toppförslag (4) + bubblare (6), **mestadels icke-spel-arenor** (kulturpolitik, kreativa näringar, kreativ export, upphovsrätt, regional utveckling, AI) där agendan landar hos en bredare publik. Spinnpasset (institutsdebatten 24946) ligger som topp. Varje pass med live tider/arrangörer + vinkel "varför för Peter".

## Filkarta
```
app/peter-lubeck/page.tsx            Serverkomponent (force-dynamic, som /better-shelter). Hårdkodad PEOPLE-lista
                                     (namn+id+roll) → hämtar varje persons 2026-schema live. Panels ur source/pl_panels.json.
app/peter-lubeck/PeterLubeckView.tsx Klientkomponent (personkort + scheman + rekommenderade pass + karta).
source/pl_panels.json                Kuraterade pass (eventId + niche/fit/tier/angle). Live event-detaljer hämtas.
```

## Anpassningar mot Better Shelter-mallen
- PersonSched har ett kuraterat `role`-fält (parti + roll) som visas, i stället för den skrapade titeln.
- Panelsektionen heter "Rekommenderade pass för Peter" och är inriktad på rum **utanför** spelspåret.
- SpelAlmedalen är medvetet nedtonat (han kan det) — bara institutsdebatten + det regionala klusterpasset finns med, som policy.

## Historik
- v1 (2026-06-21): Vertex-style seminariekarta över SpelAlmedalen → underkänd ("bara spelarenan han redan känner till"). Gamla filer (build_peter_lubeck.py, peter_lubeck_seminars/people.json, PeterLubeckMap.tsx) borttagna.
- v2 (2026-06-22): ombyggd till Better Shelter-personvyn + rekommenderade pass.

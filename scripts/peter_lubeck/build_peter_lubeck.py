"""Bygg Peter Lübeck / Game Habitat Almedalskarta-data.

Samma mönster som Vertex/Eli Lilly, men ANPASSAT: avsändare är Peter Lübeck (VD Game
Habitat). Syfte: driva en nationell strategi för dataspel + ett nationellt
dataspelsinstitut. Ingen "konkurrent"-logik — i stället allierade + politiker att påverka.

Påverkansunderlaget är inriktat (enligt kund) på KANDIDATER TILL KULTUR- OCH
NÄRINGSMINISTER samt kultur-/näringstalespersoner för C, S och MP, plus andra
politiker som är särskilt engagerade i dataspelsfrågan (tvärs partierna). Alla
namn/roller/partier är verifierade via research (juni 2026).

Källa: tmp/peter_lubeck/spel_events.json (live event-data).
Output: source/peter_lubeck_seminars.json + source/peter_lubeck_people.json
"""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAND = {c["event_id"]: c for c in json.load(open(ROOT / "tmp/peter_lubeck/spel_events.json"))}

# tema: strategi | regional | talang | konkurrenskraft | kultur
CUR = {
 # ---- PRIORITERA ----
 24946: ("strategi","prioritera","sok-talarplats","Veckans viktigaste pass för dig. Hela debatten om nationell strategi och dataspelsinstitut, med avstamp i Region Skånes förstudie (institut placerat i Skåne = din hemmaplan). Mats Berglund (MP, ordförande i kulturutskottet) sitter i panelen. Sök talarplats, eller fånga panelen direkt efteråt."),
 25206: ("regional","prioritera","sok-talarplats","Game Habitats kärnfråga: regional utveckling, klusterstöd och strukturella hinder i hela landet. Här argumenterar du för fortsatt klusterfinansiering och SCORE-modellen ur ett Malmö-/Skåneperspektiv."),
 24949: ("konkurrenskraft","prioritera","delta","Industrinära forskning som tillväxtmotor. Knyt forskningen till institutets samordnande roll (data, kompetens, IP) — ett konkret innehåll att fylla en nationell strategi med."),
 25197: ("talang","prioritera","delta","Lönegolvet för arbetskraftsinvandring som hot mot små studios och startups. Skarp, lokal historia efter Malmö-nedskärningarna (Massive, Sharkmob). Kompetensförsörjning är en bärande pelare i strategin."),
 25278: ("talang","prioritera","delta","Quest for Talent: rekryteringsbas, mångfald och kompetensförsörjning. Game Habitats inkluderings- och talangarbete ligger direkt på temat."),
 25201: ("konkurrenskraft","prioritera","delta","AI i spelbranschen, bortom det generativa. Framtidsfråga som hör hemma i en nationell strategi och i ett instituts bevakningsuppdrag."),
 25204: ("konkurrenskraft","prioritera","delta","Global marknad, fragmenterad reglering och marknadshinder. EU-konkurrenskraft och export — chansen att omframa frågan från kultur till en 73-miljardersexportnäring."),
 25148: ("kultur","prioritera","delta","‘Böcker och spel — konkurrenter eller kompisar?’ Spel som kultur och berättelse, med Per Strömbäck (Dataspelsbranschen). Kulturlegitimitet plus nätverkande med den nationella branschrösten."),
 # ---- BEVAKA ----
 102285: ("konkurrenskraft","bevaka","bevaka","Elektronikskatten efter valet (2,7 mdr/år). Konkret skatte- och branschfråga, möjligt sakpolitiskt delmål."),
 24955: ("konkurrenskraft","bevaka","bevaka","Hållbarhet som svensk spelstyrka (engelska). Här syns Rickard Nordin (C), din starkaste institutsallierade — bra nätverkstillfälle."),
 25054: ("kultur","bevaka","bevaka","Democracy Defence Level Up: hot mot demokratin i spelmiljöer. Del av serien om spel och demokrati."),
 25280: ("kultur","bevaka","bevaka","Democracy Defence Level Up: spel som plattform för desinformation — eller demokratisk motståndskraft."),
 25281: ("kultur","bevaka","bevaka","Moralpanik och skärmpolitik, med ungdomsförbunden. Motbild till skärmtidsdebatten — relevant för branschens anseende."),
 25198: ("kultur","bevaka","bevaka","Ungas fritid och ofrivillig ensamhet — spelkulturen som social arena. Folkhälsovinkel."),
 25283: ("kultur","bevaka","bevaka","‘Spel räddar liv’ — spel för trygga, inkluderande miljöer och kompetenser."),
 25282: ("kultur","bevaka","bevaka","Ungt föreningsliv i ytterstaden (Sverok-vinkel). Engagemang och demokrati."),
 25130: ("kultur","bevaka","bevaka","SpelAlmedalens öppna mötesplats/nav (‘Spel i vardagen, vetenskapen och världen’, återkommande). Här nätverkar du mellan passen."),
}

# Kartnålar (utanför navet) — var du kan fånga minister-kandidaterna. Explicita koordinater.
TARGETS = [
 {"name":"🎯 Björn Wiechel (S) — kulturministerkandidat","seminar":"Hur skapar vi kulturell välfärd?","day":"onsdag","location":"Bredgatan 10, Länsteatern","lat":57.6378,"lng":18.2924},
 {"name":"🎯 Amanda Lind (MP) — kulturministerkandidat","seminar":"Miljöpartiets modell","day":"torsdag","location":"Strandvägen 4.2, Dagens industri","lat":57.6413,"lng":18.2898},
 {"name":"🎯 Fredrik Olovsson (S) — näringsministerkandidat","seminar":"Hur bygger vi världens främsta gruvnation?","day":"tisdag","location":"Hamngatan 3, Näringslivets trädgård","lat":57.6389,"lng":18.2906},
 {"name":"🎯 Anders Ådahl (C) — näringsministerkandidat","seminar":"Elens gordiska knut","day":"tisdag","location":"S:ta Katarinagatan 6, Arena Energi","lat":57.6405,"lng":18.2951},
 {"name":"🎯 Vasiliki Tsouplaki (V) — kulturtalesperson","seminar":"Folkbildningsvalet","day":"onsdag","location":"Donners plats 1, Donnerska huset","lat":57.6390,"lng":18.2914},
]

# Påverkansunderlag (handsatt, verifierat). kategori:
#   kulturminister | naringsminister | champions | allierade | beslutsfattare
PEOPLE = [
 # --- Kandidater till kulturminister (C/S/MP + sittande) ---
 {"name":"Björn Wiechel","title":"kulturpolitisk talesperson, gruppledare kulturutskottet","org":"Socialdemokraterna","category":"kulturminister","n_core":0,
  "note":"S:s kulturministerkandidat och frontfigur bakom S/V/MP:s krav på en statlig utredning för spelbranschen. Syns ons i kulturspåret (kulturell välfärd @ Bredgatan 10, mediestöd, folkbildning)."},
 {"name":"Amanda Lind","title":"språkrör, fd kulturminister","org":"Miljöpartiet","category":"kulturminister","n_core":0,
  "note":"MP:s tyngsta kulturnamn och troliga kulturministerkandidat; medförfattare till MP:s motion om nationell dataspelsstrategi. Syns tis–tors (MP-modell @ Strandvägen 4.2 tors)."},
 {"name":"Catarina Deremar","title":"kulturpolitisk talesperson","org":"Centerpartiet","category":"kulturminister","n_core":0,
  "note":"Centerns kulturpolitiska talesperson. Syns ons @ Donners plats 1 (folkbildning, civilsamhällets villkor)."},
 {"name":"Parisa Liljestrand","title":"kulturminister (sittande)","org":"Moderaterna","category":"kulturminister","n_core":0,
  "note":"Avgör regeringens linje i dag — hänvisar till KKN-strategin i stället för en spelstrategi. Positiv till spel men levererar inte. Ej i 2026-programmet; sök möte separat."},
 # --- Kandidater till näringsminister (C/S/MP + sittande) ---
 {"name":"Fredrik Olovsson","title":"närings- och energipolitisk talesperson, gruppledare näringsutskottet","org":"Socialdemokraterna","category":"naringsminister","n_core":0,
  "note":"S:s näringsministerkandidat. Här landar exportnärings-omframningen. Syns tis–tors (gruvnation @ Hamngatan 3 tis, kommunen & kapitalet, energifrågorna)."},
 {"name":"Anders Ådahl","title":"näringspolitisk talesperson","org":"Centerpartiet","category":"naringsminister","n_core":0,
  "note":"Centerns näringspolitiska talesperson (sedan dec 2025). Syns tis (Elens gordiska knut @ S:ta Katarinagatan 6, gruvnation)."},
 {"name":"Janine Alm Ericson","title":"ekonomisk-politisk talesperson","org":"Miljöpartiet","category":"naringsminister","n_core":0,
  "note":"MP:s närmaste näringsministerkandidat (driver grön industri och företagande). Syns ons–tors (tillväxt/besöksnäring @ Hamngatan 3)."},
 {"name":"Ebba Busch","title":"energi- och näringsminister, vice statsminister","org":"Kristdemokraterna","category":"naringsminister","n_core":0,
  "note":"Sittande närings-/energiminister. Exportnäringsargumentet hör hemma här. Syns tis (partiledarutfrågning @ TV4)."},
 # --- Extra intresserade: dataspels-vänner tvärs partierna ---
 {"name":"Rickard Nordin","title":"1:e vice partiledare, e-sportprofil","org":"Centerpartiet","category":"champions","n_core":0,
  "note":"Skrev motionen om ett nationellt dataspelsinstitut + att vidga kulturbegreppet till spel. Din starkaste enskilda allierade. På SpelAlmedalen (tis 11:00, Strandgatan 1b)."},
 {"name":"Mats Berglund","title":"ordförande, kulturutskottet","org":"Miljöpartiet","category":"champions","n_core":1,
  "note":"Ledde riksdagens kunskapsöversikt om dataspel (RFR6). På ‘Kulturpolitik för spelundret’ (ons 09:30, SpelAlmedalen) — din viktigaste kontakt på plats."},
 {"name":"Peter Ollén","title":"ledamot, kulturutskottet","org":"Moderaterna","category":"champions","n_core":0,
  "note":"Regeringssidans spel-vän: arrangerade ‘Spel är kultur för alla’ och fick igenom ett tillkännagivande om förenklingar för dataspelsbranschen. Nyckel för att få M/KD/L ombord. Ej i 2026-programmet."},
 {"name":"Sofia Skönnbrink","title":"riksdagsledamot (Värmland)","org":"Socialdemokraterna","category":"champions","n_core":0,
  "note":"Förstanamn på S-motionen om att utreda ett nationellt dataspelsinstitut (KrU6). Syns tors (forsknings-/djurspåret)."},
 {"name":"Anne-Li Sjölund","title":"idrottspolitisk talesperson","org":"Centerpartiet","category":"champions","n_core":0,
  "note":"Motionär för en nationell spelstrategi (C). Syns i spelpolitik-panelen tors @ Strandgatan 35."},
 {"name":"Vasiliki Tsouplaki","title":"kulturpolitisk talesperson","org":"Vänsterpartiet","category":"champions","n_core":0,
  "note":"Medinitiativtagare till S/V/MP:s utredningsinitiativ. Syns ons (folkbildning @ Donners plats 1) + spelpolitik tors."},
 {"name":"Alexander Christiansson","title":"kulturpolitisk talesperson","org":"Sverigedemokraterna","category":"champions","n_core":0,
  "note":"SD stöder dataspelsinstitut och spelstrategi (reservationer). Breddar stödet bortom oppositionen. Syns ons (mediestöd @ Mellangatan 7, konstnärlig frihet)."},
 {"name":"Lars Mejern Larsson","title":"riksdagsledamot (Värmland)","org":"Socialdemokraterna","category":"champions","n_core":0,
  "note":"Initierade frågan om en samlad spelpolitik (skriftlig fråga 2025). Ej i 2026-programmet."},
 # --- Allierade & ekosystem ---
 {"name":"Per Strömbäck","title":"talesperson","org":"Dataspelsbranschen","category":"allierade","n_core":1,
  "note":"Nationell branschröst. På ‘Böcker och spel’ (ons, SpelAlmedalen)."},
 {"name":"Dataspelsbranschen","title":"nationell branschorganisation","org":None,"category":"allierade","n_core":0,
  "note":"Kärnarrangör SpelAlmedalen. Driver branschens policyprioriteringar."},
 {"name":"Sverok","title":"Spelkulturförbundet","org":None,"category":"allierade","n_core":0,
  "note":"Kärnarrangör SpelAlmedalen. Spelarrörelsen och ungdomsperspektivet."},
 {"name":"Uppsala universitet","title":"Institutionen för speldesign, Campus Gotland","org":None,"category":"allierade","n_core":0,
  "note":"Kärnarrangör SpelAlmedalen — navet ligger i deras lokaler (Strandgatan 1b)."},
 {"name":"Svenska Spelforskarrådet","title":"forskningsråd","org":None,"category":"allierade","n_core":0,
  "note":"Kärnarrangör. Forskningslegitimitet för strateginarrativet."},
 {"name":"Region Skåne","title":"regional aktör","org":None,"category":"allierade","n_core":0,
  "note":"Bakom institutsförstudien (okt 2024) med Skåne-placering — din starkaste institutionella allierade."},
 {"name":"Regionala klustren (SCORE)","title":"Sweden Game Arena, The Great Journey, Arctic Game, Gameport","org":None,"category":"allierade","n_core":0,
  "note":"Dina SCORE-partners (Tillväxtverket, 13,4 mkr). Enad röst för klustermodellen och en gemensam nationell inkubator."},
 # --- Beslutsfattare & myndigheter ---
 {"name":"Tillväxtverket","title":"myndighet","org":None,"category":"beslutsfattare","n_core":0,
  "note":"Finansierar SCORE + KKN-strategin. Närings-/tillväxtvägen in i staten — lättare för borgerligheten än ‘kultur’."},
 {"name":"Kulturdepartementet","title":"regeringskansliet","org":None,"category":"beslutsfattare","n_core":0,
  "note":"Äger regeringens linje. Omframa frågan från kultur till näring och export."},
 {"name":"Kulturrådet","title":"statlig kulturmyndighet","org":None,"category":"beslutsfattare","n_core":0,
  "note":"Möjlig hemvist för institutsfunktioner (statistik, stöd, samordning)."},
]

THEME_LABEL = {
  "strategi":"Nationell strategi & institut","regional":"Regional utveckling & kluster",
  "talang":"Talang & kompetens","konkurrenskraft":"Forskning, AI & konkurrenskraft",
  "kultur":"Kultur, unga & demokrati",
}
ACTION_LABEL = {"delta":"Delta","sok-talarplats":"Sök talarplats","boka-mote":"Boka möte","bevaka":"Bevaka"}

seminars=[]
for eid,(theme,tier,action,angle) in CUR.items():
    c = CAND.get(eid)
    if not c:
        print(f"VARNING: {eid} saknas i kandidatdata"); continue
    seminars.append({
      "event_id": eid, "title": c["title"], "day": c["day"], "start": c["start"], "end": c["end"],
      "location": c["location"], "lat": None, "lng": None, "url": c["url"],
      "arrangers": (c.get("arrangers") or [])[:3], "n_speakers": 0,
      "theme": theme, "theme_label": THEME_LABEL[theme],
      "layer": "core" if tier=="prioritera" else "watch", "tier": tier,
      "action": action, "action_label": ACTION_LABEL[action], "angle": angle,
    })
for t in TARGETS:
    seminars.append({
      "event_id": 0, "title": f"{t['name']} — {t['seminar']}", "day": t["day"], "start": None, "end": None,
      "location": t["location"], "lat": t["lat"], "lng": t["lng"], "url": None,
      "arrangers": [], "n_speakers": 0, "theme": "politiker", "theme_label": "Målpolitiker",
      "layer": "target", "tier": "target", "action": "traffa", "action_label": "Träffa", "angle": "",
    })

os.makedirs(ROOT/"source", exist_ok=True)
json.dump(seminars, open(ROOT/"source/peter_lubeck_seminars.json","w"), ensure_ascii=False, indent=1)
json.dump(PEOPLE, open(ROOT/"source/peter_lubeck_people.json","w"), ensure_ascii=False, indent=1)

from collections import Counter
core=[s for s in seminars if s["layer"]=="core"]; watch=[s for s in seminars if s["layer"]=="watch"]
print(f"seminarier: core {len(core)}, bevaka {len(watch)}, kartnålar {len(TARGETS)}")
print(f"personer: {len(PEOPLE)}  per kategori: {dict(Counter(p['category'] for p in PEOPLE))}")

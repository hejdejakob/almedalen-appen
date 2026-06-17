"""Bygg Eli Lilly Almedalskarta-data (samma mönster som scripts/vertex/build_vertex.py).

Deterministisk sammanställning. Kureringen (vilka seminarier, tema, tier, åtgärd,
vinkel) är redaktionellt satt nedan av Reform Society utifrån Eli Lillys två
sakområden: obesitas (vikt, läkemedel, vem betalar) och Alzheimer (tidig diagnos,
nya behandlingar, demensvård) — plus access/pris/ordnat införande runtomkring.

Källor:
  tmp/eli_lilly/candidate_seminars.json  (live event-data: arrangörer, talarantal, plats)
  tmp/eli_lilly/candidate_people.json    (återkommande personer i relevanta seminarier)

Output:
  source/eli_lilly_seminars.json   (slutlig, läses av app/eli-lilly/page.tsx)
  source/eli_lilly_people.json      (slutlig)
  tmp/eli_lilly/verify_payload.json  (kompakt underlag för ev. adversariell verifiering)
"""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAND = json.load(open(ROOT / "tmp/eli_lilly/candidate_seminars.json"))
PPL = json.load(open(ROOT / "tmp/eli_lilly/candidate_people.json"))
by_id = {c["event_id"]: c for c in CAND}

# Konkurrenter (exkl. Eli Lilly självt). Novo Nordisk = primär obesitas-konkurrent;
# Eisai/BioArctic/Roche = Alzheimer; Danone Nutricia = nutrition (angränsande).
COMPETITORS = ["novo nordisk","eisai","bioarctic","roche","astrazeneca","novartis","pfizer",
  "sanofi","msd","merck","abbvie","amgen","boehringer","gsk","janssen","biogen","lundbeck",
  "takeda","bayer","danone","nutricia"]

# tema: obesitas | prevention | alzheimer | diagnos | access
# tier: prioritera | bevaka ; action: delta | sok-talarplats | boka-mote | bevaka
CUR = {
 # ---- KÄRNA (prioritera) ----
 102288: ("obesitas","prioritera","delta","Eli Lillys eget pass. Socialstyrelsen klassar obesitas som kronisk sjukdom, men TLV sa nej till subvention av Wegovy i februari 2026 och Lillys Mounjaro subventioneras bara vid typ 2-diabetes, inte vid obesitas. Gapet mellan riktlinje och betalningsmodell är exakt Lillys kärnfråga. Hemmaplan."),
 91493: ("obesitas","prioritera","delta","Eli Lillys eget pass. Modern, patientnära obesitasvård bortom läkemedlet, med fokus på den ojämlika vården och eftersläpande kunskapsstyrningen. Lillys plattform för att äga helhetsbilden av obesitasvården."),
 36263: ("obesitas","prioritera","sok-talarplats","Neutral läkararena (Läkartidningen, 6 talare) om själva kärnfrågan: vilka ska behandlas med obesitasläkemedel och vem betalar notan? Efter TLV:s nej till Wegovy köps GLP-1 för omkring 1,2 miljarder kronor per år utanför förmånen. Ingen konkurrent som värd. Sök talarplats, här formas berättelsen om vem som ska få behandling."),
 25435: ("obesitas","prioritera","boka-mote","Regionarrangerat (Region Jönköpings län, 7 talare): behandling finns, men hur ska samhället ha råd? Access- och finansieringsfrågan sedd från beställarsidan. En viktig dialogpost med politiker och region."),
 35720: ("obesitas","prioritera","delta","Brett upplagt (Apotek Hjärtat, 7 talare): hur viktminskningsläkemedel förändrar samhället, jämlik tillgång, kostnad, prevention och apotekens roll. En neutral systemarena där Lillys access-argument hör hemma."),
 36027: ("obesitas","prioritera","delta","Tankesmedjeperspektiv (Synaps): obesitasläkemedel som produktivitetsfråga, inte bara vårdkostnad. Lillys hälsoekonomiska argument i ren form, utan konkurrent som värd."),
 91443: ("alzheimer","prioritera","delta","Reform Societys eget pass (med BioArctic och Eisai bakom lecanemab/Leqembi): ska Alzheimer hanteras som cancer, med strukturerat införande? NT-rådet avrådde regionerna från Leqembi i april 2026 (ej kostnadseffektivt). Hemmaplan för byrån, och spaning rakt in i konkurrentlägret medan Lillys egen Kisunla (donanemab) väntar på TLV:s bedömning."),
 147111: ("alzheimer","prioritera","delta","Hög-prioriterad spaning: BioArctic (svensk forskning bakom lecanemab/Leqembi) om nya EU-godkända Alzheimerbehandlingar och ett strukturerat svenskt införande. Leqembi fick NT-rådets avrådan i april 2026; Lillys Kisunla (EU-godkänt sep 2025) ligger hos TLV. Var i rummet där berättelsen formas."),
 47450: ("diagnos","prioritera","bevaka","Behövs en nationell handlingsplan för Alzheimer? Roche Diagnostics äger diagnostikfrågan, och tidig, biomarkörbekräftad diagnos (blodtest p-tau217) är förutsättningen för att de nya läkemedlen ska fungera. Policy- och kapacitetsspåret som avgör om Kisunla och Leqembi når patienter. Hög spaning."),

 # ---- BEVAKA (penumbra) ----
 35589: ("prevention","bevaka","bevaka","Novo Nordisk och STUNS om barnfetma och ojämlik hälsa (var sjätte fyraåring). Tung panel (9 talare). Spaning på barn- och preventionsspåret, där konkurrenten bygger folkhälsoberättelsen."),
 35709: ("prevention","bevaka","bevaka","Novo Nordisk: kan vi vända den uppåtgående viktkurvan? Prevention och folkhälsa från konkurrentens scen på Birgers gränd. Spaning."),
 35592: ("prevention","bevaka","bevaka","Novo Nordisk: obesitas och arbetslivet, produktivitet och hållbara lösningar. Arbetslivsvinkeln på obesitas. Spaning."),
 34680: ("prevention","bevaka","bevaka","Svensk Handel: hur viktminskningsmediciner förändrar köpbeteenden och handeln. Samhällseffekten bortom vården, en bredare kontext för GLP-1-vågen."),
 35875: ("obesitas","bevaka","bevaka","Novo Nordisk om vad vetenskapen säger om obesitas, stigma och folkhälsa. Konkurrenten sätter kunskapsramen. Spaning."),
 36047: ("obesitas","bevaka","bevaka","Novo Nordisk: varför är det så svårt att gå ner i vikt? Patientperspektiv från konkurrentens scen. Spaning."),
 35396: ("obesitas","bevaka","bevaka","Novo Nordisk ramar in ”obesitas – inte som andra sjukdomar” och vem som ska få läkemedelsbehandling. Konkurrentens kärnberättelse. Spaning."),
 34824: ("obesitas","bevaka","bevaka","Diabetes och obesitas i samhällsekonomiskt ljus (Alexandra – för Kvinnor & Hälsa). Angränsande metabol arena."),
 35590: ("access","bevaka","bevaka","Novo Nordisk: hur organiseras primärvården för patienter med obesitas, diabetes och hjärt-kärlsjukdom? Vårdstrukturfrågan. Spaning."),
 34690: ("access","bevaka","bevaka","Dagens Medicin om vårdens valagenda, där bättre obesitasvård nämns explicit. Neutral mediearena att bevaka."),
 35678: ("diagnos","bevaka","bevaka","”Hjärnhälsa – en nationell angelägenhet” (FOKUS Patient, workshop). Brett hjärnhälsoparaply där Alzheimer ingår. Allierad patientmiljö."),
 35677: ("alzheimer","bevaka","bevaka","Medicinsk nutritionsbehandling vid tidig Alzheimer (FOKUS Patient, Danone Nutricia). Tidig-skede-vinkeln, angränsande till läkemedelsbehandling."),
 80312: ("alzheimer","bevaka","bevaka","BPSD-registret om personcentrerad demensomvårdnad. Vårdkvalitetsspåret i Alzheimer, en allierad och evidensnära miljö."),
}
# Medvetet uteslutna (utanför Lillys kärna): 36152 (djurförsök/möss), 36517 (NPF/barn-hjärnhälsa).

THEME_LABEL = {
  "obesitas":"Obesitas & läkemedel","prevention":"Prevention & folkhälsa",
  "alzheimer":"Alzheimer & demensvård","diagnos":"Tidig diagnos & hjärnhälsa",
  "access":"Access, pris & ordnat införande",
}
ACTION_LABEL = {
  "delta":"Delta","sok-talarplats":"Sök talarplats","boka-mote":"Boka arrangörsmöte","bevaka":"Bevaka",
}

def arr_names(c): return [a["name"] for a in c["arrangers"]]
def is_competitor(c):
    blob = " ".join(arr_names(c)).lower()
    return any(p in blob for p in COMPETITORS)
def is_client(c):
    blob = " ".join(arr_names(c)).lower()
    return "eli lilly" in blob or "lilly" in blob
def is_reform(c):
    return any("reform society" in n.lower() for n in arr_names(c))

seminars=[]; verify=[]
for eid,(theme,tier,action,angle) in CUR.items():
    c = by_id.get(eid)
    if not c:
        print(f"VARNING: {eid} saknas i kandidatdata"); continue
    client = is_client(c)
    reform = is_reform(c)
    comp = is_competitor(c) and not client and not reform   # Reform-pass räknas som hemmaplan, ej konkurrent
    seminars.append({
      "event_id": eid, "title": c["title"], "day": c["day"], "start": c["start"], "end": c["end"],
      "location": c["location"], "lat": None, "lng": None, "url": c["url"],
      "arrangers": arr_names(c)[:3], "n_speakers": c["n_speakers"],
      "theme": theme, "theme_label": THEME_LABEL[theme],
      "layer": "core" if tier=="prioritera" else "watch", "tier": tier,
      "action": action, "action_label": ACTION_LABEL[action], "angle": angle,
      "competitor_arranged": comp, "client_own": client,
    })
    verify.append({"id":eid,"title":c["title"],"desc":(c.get("description") or "")[:380],
                   "arr":arr_names(c)[:3],"theme":theme,"tier":tier,"angle":angle,"competitor":comp})

core_titles = {s["title"] for s in seminars if s["layer"]=="core"}

# People — kategori satt i kandidatdatan (4 kategorier). Uteslut enskilda av-ämnet.
EXCLUDE_SPEAKER = {  # off-topic / fel kontext
}
EXCLUDE_NAMES = {"Malin Ekelund"}  # Forska utan djurförsök (kopplad till uteslutet djurförsökspass)
people=[]
for p in PPL:
    if p["speaker_id"] in EXCLUDE_SPEAKER or p["name"] in EXCLUDE_NAMES: continue
    if not p.get("category"): continue
    n_core = sum(1 for t in (p.get("events") or []) if t in core_titles)
    people.append({"name":p["name"],"title":p.get("title"),"org":p.get("org"),
      "category":p["category"],"n_relevant":p["n_relevant"],"n_core":n_core,
      "events":(p.get("events") or [])[:4]})
order={"politiker":0,"tjansteman":1,"patientledare":2,"konkurrent":3}
people.sort(key=lambda x:(order[x["category"]], -x["n_relevant"], x["name"]))

os.makedirs(ROOT/"source", exist_ok=True)
json.dump(seminars, open(ROOT/"source/eli_lilly_seminars.json","w"), ensure_ascii=False, indent=1)
json.dump(people, open(ROOT/"source/eli_lilly_people.json","w"), ensure_ascii=False, indent=1)
json.dump(verify, open(ROOT/"tmp/eli_lilly/verify_payload.json","w"), ensure_ascii=False)

from collections import Counter
print(f"seminarier: {len(seminars)} (core {sum(1 for s in seminars if s['layer']=='core')}, watch {sum(1 for s in seminars if s['layer']=='watch')})")
print(f"  per tema: {dict(Counter(s['theme'] for s in seminars))}")
print(f"  konkurrent-arrangerade: {sum(1 for s in seminars if s['competitor_arranged'])} | egna (Lilly): {sum(1 for s in seminars if s['client_own'])}")
print(f"personer: {len(people)}  per kategori: {dict(Counter(p['category'] for p in people))}")

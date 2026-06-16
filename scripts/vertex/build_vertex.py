"""Bygg Vertex Almedalskarta-data.

Deterministisk sammanställning. Kurering (vilka seminarier, tema, tier, åtgärd,
vinkel) är redaktionellt satt nedan av Reform Society utifrån Vertex sakområden:
särläkemedel, ATMP/gen- & cellterapi, sällsynta diagnoser, screening, access/pris.

Källor:
  tmp/vertex/candidate_seminars.json  (live event-data, arrangörer m. sektor, talarantal)
  tmp/vertex/candidate_people.json    (återkommande personer i relevanta seminarier)

Output:
  source/vertex_seminars.json   (slutlig, läses av app/vertex/page.tsx)
  source/vertex_people.json      (slutlig)
  tmp/vertex/verify_payload.json  (kompakt underlag för adversariell verifierings-workflow)
"""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CAND = json.load(open(ROOT / "tmp/vertex/candidate_seminars.json"))
PPL = json.load(open(ROOT / "tmp/vertex/candidate_people.json"))
by_id = {c["event_id"]: c for c in CAND}

PHARMA = ["astrazeneca","alexion","takeda","biogen","bayer","novartis","roche","msd","merck",
  "novo nordisk","eli lilly","abbvie","bristol myers","bristol-myers","pfizer","sanofi","chiesi",
  "italfarmaco","lundbeck","orion","gsk","glaxo","janssen","johnson & johnson","amgen","gilead",
  "moderna","biomarin","sobi","astellas","boehringer","teva","ucb","csl","ipsen","servier",
  "menarini","grifols","daiichi","regeneron","incyte","jazz","alnylam","argenx","danone","nordic infucare"]

# tema: särläkemedel | atmp | sällsynta | screening | access
# tier: prioritera | bevaka ; action: delta | sok-talarplats | boka-mote | bevaka
CUR = {
 # ---- KÄRNA (prioritera) — 9 rena fullträffar (efter adversariell granskning) ----
 102501: ("screening","prioritera","sok-talarplats","CF-screening är Vertex hjärtfråga: Sverige saknar nyföddhetsscreening för cystisk fibros trots att tidig upptäckt avgör. Arrangeras av CF-förbundet och Reform Society. En allierad hemmaplan för Vertex CFTR-perspektiv."),
 35141: ("särläkemedel","prioritera","boka-mote","Exakt Vertex kärnfråga: en statlig finansieringsmodell för särläkemedel. AstraZeneca äger scenen, men Vertex behöver vara i rummet där särläkemedelsekonomin definieras."),
 35308: ("särläkemedel","prioritera","sok-talarplats","Valårsvinkel på tillgången till särläkemedel, arrangerat av Kommissionen för Innovativa Särläkemedel, den centrala alliansplattformen för Vertex särläkemedelsportfölj. Sök talarplats eller medarrangörskap."),
 24631: ("atmp","prioritera","delta","Finansiering av cell- och genterapier (ATMP) som kostar tiotals miljoner per patient. Det är exakt samma fråga som avgör om Vertex Casgevy (CRISPR-genterapi mot sicklecell och beta-talassemi) når svenska patienter, och den ligger på ”avvakta” hos NT-rådet. Ett måste."),
 35293: ("atmp","prioritera","delta","ATMP-tillgång när industrin avstår: direkt relevant för hur svenska regioner och staten ska bära engångsterapier. Akademi- och regionarrangerat, ingen konkurrent. En bra lyssnarpost för Vertex argument om betalningsmodeller."),
 46619: ("atmp","prioritera","delta","”Vi kan bota det obotliga”: gen- och cellterapiernas genombrott och varför vården inte hänger med. Ramar in hela Vertex ATMP-tes. Akademiskt arrangerat (Lund och Medicon Village)."),
 36060: ("sällsynta","prioritera","boka-mote","Reformagenda för sällsynta sjukdomar: diagnostik, nationell kontra regional nivå och uppföljning av faktisk behandlingseffekt. Biogen äger frågan, men Vertex bör finnas med i samtalet om den nationella strategin (450 mkr/år 2026–28)."),
 80379: ("särläkemedel","prioritera","boka-mote","Statligt ansvar för särläkemedel. Arrangeras av Alexion (AstraZeneca Rare Disease), Vertex närmaste konkurrent inom sällsynta sjukdomar. Både hög spaningsprioritet och sakpolitiskt central."),
 102261: ("sällsynta","prioritera","delta","”Sällsynta Almedalen”: patientröster och politikersvar om livet med sällsynta hälsotillstånd. Takeda-arrangerat nav för hela patientrörelsen kring sällsynta diagnoser. Här samlas målgruppen."),

 # ---- BEVAKA (penumbra) — access, system, precisionsmedicin, screening, sällsynt-angränsande ----
 35912: ("access","bevaka","delta","Patientfokus i nationella strategier (hjärta, cancer, sällsynt diagnos). En bro mellan strategidokument och vårdvardag. AstraZeneca-arrangerat och relevant för Vertex påverkan på strategierna."),
 147092: ("access","bevaka","delta","Hela det svenska läkemedelssystemets framtid och regeringens utredning om statligt ansvar: systemfrågan som avgör om Vertex terapier når patienter. Bayer-arrangerat."),
 91204: ("screening","bevaka","sok-talarplats","Reform Societys eget pass om tidig upptäckt av ”tysta” folksjukdomar. Reform äger plattformen, en naturlig hemmaplan för att lyfta perspektivet om tidig diagnos för Vertex."),
 34963: ("access","bevaka","bevaka","Prioritering i vården när patienternas behov skiljer sig kraftigt: principdebatten bakom frågan om särläkemedel ska rymmas i budgeten."),
 91492: ("access","bevaka","bevaka","Subventions- och införandesystemet ifrågasätts när behandlingar nekas. Eli Lilly-arrangerat, med samma systemkritik som rör Vertex särläkemedel och ATMP."),
 58411: ("access","bevaka","bevaka","Läkemedelssystemet ”vid vägs ände”. Konkurrenter som BMS och Johnson & Johnson sätter agendan för vad som kan göras här och nu."),
 35732: ("access","bevaka","bevaka","”Sveriges läkemedelsval”: läkemedelspolitik och global konkurrenskraft. Arrangerat av Sanofi och AstraZeneca, med ett brett systemperspektiv."),
 35565: ("access","bevaka","bevaka","Trumps MFN-läkemedelspolitik och vad den gör med svensk tillgång och prissättning. Ett Lif-arrangerat branschperspektiv värt att bevaka."),
 24746: ("access","bevaka","bevaka","Reformer för att medicinsk innovation ska nå patienterna: ojämlik tillgång och hållbar finansiering. Roche-arrangerat."),
 25615: ("access","bevaka","bevaka","Snabbare implementering och regional ojämlikhet i införandet. Det är precis Vertex systemproblem, här i en cancerkontext. Novartis-arrangerat."),
 34777: ("access","bevaka","bevaka","Kunskapsstyrning från dokument till faktisk patientnytta. Novartis-arrangerat, och relevant för hur nya terapier rekommenderas."),
 35207: ("access","bevaka","bevaka","”Innovation eller stagnation”: två framtider för patienternas tillgång till nya behandlingar 2035. GSK-arrangerat."),
 34271: ("access","bevaka","bevaka","Förstatligande av sjukvården och ökad statlig styrning av läkemedel: strukturfrågan bakom Vertex marknadstillträde. AstraZeneca-arrangerat."),
 34201: ("access","bevaka","bevaka","Precisionsmedicin som vårdkostnad eller tillväxtmotor: implementeringsglappet i svensk vård."),
 24809: ("access","bevaka","bevaka","Europeisk genomikinfrastruktur (1+MG, Genome of Europe): grunddata för framtidens precisions- och gendiagnostik."),
 25556: ("access","bevaka","sok-talarplats","Reform Societys eget pass om framtidens hälso- och sjukvård, precisionsmedicin och hälsodata. Hemmaplan."),
 34850: ("screening","bevaka","bevaka","Nationell lungcancerscreening som dröjer trots evidens: screeningpolitikens principstrid (Siemens och Evidia, medtech)."),
 34587: ("sällsynta","bevaka","bevaka","Rätt diagnos i rätt tid vid svår epilepsi (LGS, Dravet): diagnostik av sällsynta tillstånd och patientperspektiv (Epilepsiförbundet)."),
 80310: ("access","bevaka","bevaka","Från forskning till patient inom blodcancer (Blodcancerforum). En tillgångs- och införandefråga i angränsande hematologi, i en allierad patientmiljö."),
}

CORE_TIER = "prioritera"
def is_competitor(arrangers):
    blob = " ".join(a["name"].lower() for a in arrangers)
    return any(p in blob for p in PHARMA)

THEME_LABEL = {
  "särläkemedel":"Särläkemedel & finansiering","atmp":"ATMP / gen- & cellterapi",
  "sällsynta":"Sällsynta diagnoser & strategi","screening":"Screening (CF & cancer)",
  "access":"Access, pris & precisionsmedicin",
}
ACTION_LABEL = {
  "delta":"Delta","sok-talarplats":"Sök talarplats","boka-mote":"Boka arrangörsmöte","bevaka":"Bevaka",
}

seminars=[]
verify=[]
for eid,(theme,tier,action,angle) in CUR.items():
    c = by_id.get(eid)
    if not c:
        print(f"VARNING: {eid} saknas i kandidatdata"); continue
    comp = is_competitor(c["arrangers"])
    reform_own = any("reform society" in a["name"].lower() for a in c["arrangers"])
    seminars.append({
      "event_id": eid, "title": c["title"], "day": c["day"], "start": c["start"], "end": c["end"],
      "location": c["location"], "lat": c["lat"], "lng": c["lng"], "url": c["url"],
      "arrangers": [a["name"] for a in c["arrangers"][:3]],
      "n_speakers": c["n_speakers"], "theme": theme, "theme_label": THEME_LABEL[theme],
      "layer": "core" if tier=="prioritera" else "watch", "tier": tier,
      "action": action, "action_label": ACTION_LABEL[action], "angle": angle,
      "competitor_arranged": comp, "reform_own": reform_own,
    })
    verify.append({"id":eid,"title":c["title"],"desc":(c["description"] or "")[:380],
                   "arr":[a["name"] for a in c["arrangers"][:3]],"theme":theme,"tier":tier,"angle":angle,"competitor":comp})

# People — redaktionell kategorisering (4 kategorier; övriga utelämnas)
CAT = {  # speaker_id -> kategori | None(=uteslut)
  7568:"tjansteman", 11441:"konkurrent", 3271:None, 440:"konkurrent", 3915:None,
  9538:"politiker", 3288:"tjansteman", 5083:"tjansteman", 5118:"politiker", 1321:"patientledare",
  11029:None, 2498:"patientledare", 1473:"politiker", 9342:"tjansteman",
}
CAT_OVERRIDE_BY_ORG = True  # for any other people, derive from guess unless konkurrent/politiker/patientledare clear
ppl_by_id={p["speaker_id"]:p for p in PPL}
people=[]
for p in PPL:
    sid=p["speaker_id"]
    cat = CAT.get(sid, "USE_GUESS")
    if cat=="USE_GUESS":
        g=p["cat_guess"]
        cat = g if g in ("konkurrent","politiker","tjansteman","patientledare") else None
    if cat is None: continue
    if p["n_relevant"]<2 and p["n_core"]<1: continue
    people.append({"name":p["name"],"title":p.get("title"),"org":p.get("org"),
      "category":cat,"n_relevant":p["n_relevant"],"n_core":p["n_core"],"events":p.get("events",[])[:4]})
order={"politiker":0,"tjansteman":1,"patientledare":2,"konkurrent":3}
people.sort(key=lambda x:(order[x["category"]], -x["n_relevant"]))

os.makedirs(ROOT/"source", exist_ok=True)
json.dump(seminars, open(ROOT/"source/vertex_seminars.json","w"), ensure_ascii=False, indent=1)
json.dump(people, open(ROOT/"source/vertex_people.json","w"), ensure_ascii=False, indent=1)
json.dump(verify, open(ROOT/"tmp/vertex/verify_payload.json","w"), ensure_ascii=False)

from collections import Counter
print(f"seminarier: {len(seminars)} (core {sum(1 for s in seminars if s['layer']=='core')}, watch {sum(1 for s in seminars if s['layer']=='watch')})")
print(f"  per tema: {dict(Counter(s['theme'] for s in seminars))}")
print(f"  konkurrent-arrangerade: {sum(1 for s in seminars if s['competitor_arranged'])}")
print(f"personer: {len(people)}  per kategori: {dict(Counter(p['category'] for p in people))}")
print(f"verify_payload: {len(verify)} poster")

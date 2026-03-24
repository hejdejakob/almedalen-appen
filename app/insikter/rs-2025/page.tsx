'use client';

import PasswordGate from '@/components/PasswordGate';

export default function InsikterPage() {
  return (
    <PasswordGate>
      <InsikterContent />
    </PasswordGate>
  );
}

function InsikterContent() {
  return (
    <div style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
      <header style={{ padding: '2rem 1.5rem 1rem', maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ fontSize: '0.75rem', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
          Reform Society — Intern analys
        </div>
        <h1 style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(2rem, 6vw, 3.5rem)',
          margin: 0,
          lineHeight: 1.05,
          color: '#ff6632',
        }}>
          10 SPANINGAR FRÅN ALMEDALSDATA
        </h1>
        <p style={{ fontSize: '1rem', color: '#999', marginTop: '0.75rem', lineHeight: 1.5 }}>
          Baserat på 9 407 seminarier, 16 509 talare och 3 053 arrangörer, 2022–2025.
        </p>
      </header>

      <main style={{ maxWidth: '700px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>

        <Spaning
          nr={1}
          rubrik="Försvar & säkerhet exploderar — +59% på ett år"
          text="Ingen fråga har vuxit så snabbt. Från nischämne 2022 till Almedalens fjärde största kluster 2025 med 509 seminarier. Ukraina, NATO-medlemskap och totalförsvar har gjort säkerhetspolitik till alla sektorers angelägenhet — inte bara Försvarsmaktens."
          siffra="+59%"
          siffraLabel="YoY 2024→2025"
        />

        <Spaning
          nr={2}
          rubrik="Integration & migration gör comeback — +114%"
          text="Efter att ha varit närmast osynligt 2023–2024 fördubblas antalet migrationsseminarier till 2025. Valåret 2026 närmar sig och partierna positionerar sig. Mönstret liknar 2022 (förra valåret) — migrationsfrågan är cyklisk och politiskt driven."
          siffra="+114%"
          siffraLabel="YoY 2024→2025"
        />

        <Spaning
          nr={3}
          rubrik="Näringslivet tar över — från 16% till 21% av alla seminarier"
          text="Näringslivets andel av Almedalens totala seminarieproduktion har ökat stadigt och nådde 21% 2025. Det innebär att var femte seminarium arrangeras av ett privat företag. Civilsamhället är fortfarande störst (~23%) men gapet krymper snabbt."
          siffra="21%"
          siffraLabel="Näringslivets andel 2025"
        />

        <Spaning
          nr={4}
          rubrik="Medierna tappar — men äger fortfarande agendan"
          text="Medias andel som arrangörer halverades nästan (8.2% → 5.8%). Men tittar man på maktindex toppar Expressen och Dagens Industri överlägset. De arrangerar mest, bjuder in flest och sätter agendan — trots att sektorn som helhet krymper. Makt genom kvalitet, inte kvantitet."
          siffra="#1 & #2"
          siffraLabel="Expressen + DI i maktindex"
        />

        <Spaning
          nr={5}
          rubrik="Partierna drar sig tillbaka — halverad närvaro"
          text="Politiska partier stod för 2.2% av seminarierna 2022 (valår). 2025 är siffran 1.1%. Partierna arrangerar allt mindre själva men deras företrädare syns desto mer som inbjudna talare — 5 av topp 20-talare är moderater. Partierna outsourcar sitt budskap."
          siffra="1.1%"
          siffraLabel="Partiernas andel 2025"
        />

        <Spaning
          nr={6}
          rubrik="Almedalens ton blir mörkare — men lösningarna ökar"
          text="Sentimentet är stabilt negativt (snittpoäng −0.07 till −0.09 varje år). Problemformulering dominerar framing (1 097 seminarier 2025). Men — lösningsfokuserade seminarier ökar också (620 → 772). Almedalen handlar om problem, men fler försöker lösa dem."
          siffra="−0.07"
          siffraLabel="Snittsentiment 2025"
        />

        <Spaning
          nr={7}
          rubrik="Svante Axelsson — Almedalens mest eftertraktade röst"
          text="Fossilfritt Sveriges samordnare har bredast spridning av alla talare (breadth 25.0) — dvs flest unika arrangörer bjuder in honom. Jämför med Viktor Barth-Kron (Expressen) som har flest paneler (68) men nästan bara för sin arbetsgivare (breadth 1.9). Volym ≠ inflytande."
          siffra="25.0"
          siffraLabel="Breddpoäng (högst av alla)"
        />

        <Spaning
          nr={8}
          rubrik="Näringsliv blir pessimistiskt"
          text="Näringslivets sentiment svängde dramatiskt: från svagt positivt (+0.015) 2022 till klart negativt (−0.106) 2025. Ingen annan sektor har haft en lika stor tonförändring. Fastighetskris, konjunkturnedgång och geopolitisk oro präglar företagens berättelser."
          siffra="−0.106"
          siffraLabel="Näringslivets sentiment 2025"
        />

        <Spaning
          nr={9}
          rubrik="AI & digitalisering — stadigt uppåt men ingen hype-topp"
          text="Digitaliseringsseminarier växer med +14% per år, stabilt utan överhettning. 360 seminarier totalt. AI har normaliserats från buzzword till verktyg — det dyker upp i fastighetspaneler, försvarsseminarier och vårdsamtal snarare än i egna AI-events."
          siffra="+14%"
          siffraLabel="YoY digitalisering/AI"
        />

        <Spaning
          nr={10}
          rubrik="Klimat är störst men tappar — vem fyller tomrummet?"
          text="Klimat & miljö är fortfarande Almedalens största ämne med 1 063 seminarier — men det krymper (−2.9% YoY). Samtidigt växer försvar, näringsliv och EU-frågor. Almedalens agenda breddas. Frågan är om klimatrörelsen tappat narrativet eller om frågan blivit så mainstream att den absorberas i andra ämnen."
          siffra="1 063"
          siffraLabel="Seminarier totalt (störst)"
        />

        <div style={{
          marginTop: '3rem',
          padding: '1.5rem',
          borderTop: '1px solid #333',
          fontSize: '0.8rem',
          color: '#666',
          lineHeight: 1.6,
        }}>
          <strong style={{ color: '#999' }}>Metod:</strong> Data från Almedalsveckans officiella program 2022–2025. 
          Ämnesklassificering, sentimentanalys och sektorklassificering gjord med AI (Claude). 
          Talare identifierade genom NER-parsning av seminariebeskrivningar (2022–2024) och 
          programdata (2025). 9 407 events, 16 509 talare, 3 053 arrangörer.
          <br /><br />
          <strong style={{ color: '#999' }}>Källa:</strong> Almedalsdata.se — Reform Society, mars 2026.
        </div>
      </main>
    </div>
  );
}

function Spaning({ nr, rubrik, text, siffra, siffraLabel }: {
  nr: number;
  rubrik: string;
  text: string;
  siffra: string;
  siffraLabel: string;
}) {
  return (
    <article style={{
      padding: '2rem 0',
      borderBottom: '1px solid #222',
    }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{
          fontFamily: 'var(--font-formula)',
          fontSize: '2.5rem',
          color: '#ff6632',
          lineHeight: 1,
          flexShrink: 0,
          width: '2.5rem',
          textAlign: 'right',
        }}>
          {nr}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.2rem, 3vw, 1.6rem)',
            margin: '0 0 0.75rem',
            lineHeight: 1.2,
            color: '#fff',
          }}>
            {rubrik}
          </h2>
          <p style={{
            fontSize: '0.95rem',
            color: '#bbb',
            lineHeight: 1.7,
            margin: 0,
          }}>
            {text}
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: '0.5rem',
            marginTop: '0.75rem',
            padding: '0.4rem 0.8rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
          }}>
            <span style={{
              fontFamily: 'var(--font-formula)',
              fontSize: '1.3rem',
              color: '#ff6632',
            }}>
              {siffra}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#888' }}>
              {siffraLabel}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

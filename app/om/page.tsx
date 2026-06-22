import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Om Almedalsdata | Reform Society',
  description: 'Metodik, datakällor och analysmetoder bakom Almedalsdata.',
  robots: { index: false, follow: false },
};

export default function OmPage() {
  return (
    <div style={{ backgroundColor: 'var(--rs-natur, #f7f5e4)', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem 0',
        borderBottom: '4px solid #fb531a',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 2rem' }}>
          <a href="/" style={{ color: '#fb531a', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            ← Tillbaka till dashboarden
          </a>
          <h1 style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: '0.5rem 0 0' }}>
            OM ALMEDALSDATA
          </h1>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem', lineHeight: 1.7, fontSize: '1.05rem' }}>

        <Section title="Datakällor">
          <p>
            Almedalsdata bygger på samtliga publicerade programpunkter från Almedalsveckan 2022–2026.
            Totalt innehåller databasen <strong>9 407 events</strong>.
          </p>
          <ul>
            <li>
              <strong>2025–2026:</strong> Webb-scraper (Playwright) som hämtar events direkt från
              Almedalsveckans officiella webbkalendarium, inklusive medverkande och kontaktpersoner
              från varje eventdetalj-sida.
            </li>
            <li>
              <strong>2022–2024:</strong> PDF-parser som extraherar och konverterar de officiella
              programkatalogerna i PDF-format till strukturerad data.
            </li>
          </ul>
          <YearTable />
        </Section>

        <Section title="Enrichment-pipeline">
          <p>
            Rådatan berikas i fyra steg. Enrichment skrivs till separata tabeller — rådatan rörs aldrig.
            Alla jobb är idempotenta och kördes med Claude Code-agenter (inte API-anrop).
          </p>
          <ol>
            <li>
              <strong>Sektorklassificering:</strong> 3 081 arrangörer klassificeras i 10 sektorer
              (näringsliv, civilsamhälle, parti, etc.) med undersektorer. Arrangörer med
              confidence &lt; 0.8 flaggas för manuell granskning.
            </li>
            <li>
              <strong>Ämneskluster:</strong> Varje event tilldelas ett eller flera av 21 låsta
              ämneskluster (arbetsmarknad, klimat, digitalisering, etc.). För PDF-data
              kartlades de befintliga ämneskategorierna direkt.
            </li>
            <li>
              <strong>Talare &amp; NER:</strong> Medverkande extraheras ur eventbeskrivningar.
              16 509 unika talare identifierades med 40 257 event-speaker-kopplingar.
              Namnvarianter normaliseras och dedupliceras.
            </li>
            <li>
              <strong>Sentiment:</strong> Titlar och beskrivningar analyseras för ton (positiv/neutral/negativ),
              brådskande-grad och framing (problem/lösning/neutral).
            </li>
          </ol>
        </Section>

        <Section title="Analysmetodik">
          <p><strong>Agendakraftindex</strong> — kombinerar tre dimensioner för varje organisation:
            antal egna seminarier, panelplatser givna till andra aktörer, samt egna talare
            i andras paneler. Visar vem som är sändare respektive mottagare i Almedalen.</p>

          <p><strong>Venue-normalisering</strong> — ~100 adressvarianter i rådatan mappas till
            ~50 kanoniska arenanamn (t.ex. &quot;Donnersgatan 6&quot; → &quot;Hansaplatsen&quot;).
            149 platser geocodades för Visbykartan, vilket täcker 73 % av alla events.</p>

          <p><strong>Nätverksgrafer</strong> — organisationer kopplas genom delade paneldeltaganden.
            Force-directed layout med D3. Kantens tjocklek motsvarar antal gemensamma talare.
            Kluster i grafen representerar informella allianser.</p>

          <p><strong>Arena-nätverksgraf</strong> — bipartit graf med arenor och organisationer som
            nodtyper. Kanter visar att en organisation arrangerat 2+ events på en arena.</p>

          <p><strong>Arrangörsnormalisering</strong> — samma organisation räknas som en entitet
            oavsett namnvarianter mellan åren. Dotterbolag och moderbolag behandlas som
            separata entiteter.</p>
        </Section>

        <Section title="Teknik">
          <ul>
            <li><strong>Framework:</strong> Next.js (App Router), React, TypeScript</li>
            <li><strong>Databas:</strong> Supabase (PostgreSQL)</li>
            <li><strong>Visualisering:</strong> D3.js (Sankey, nätverksgrafer), Chart.js (staplar, linjer, bubblor), Leaflet (karta)</li>
            <li><strong>Enrichment:</strong> Claude Code-agenter (Haiku för klassificering, Sonnet för granskning)</li>
            <li><strong>Scraping:</strong> Playwright</li>
          </ul>
        </Section>

        <Section title="Kontakt">
          <p>
            Almedalsdata är ett projekt av <strong>Reform Society</strong>.
            <br />
            Kontakt: <a href="mailto:jakob@reformsociety.se" style={{ color: '#fb531a' }}>jakob@reformsociety.se</a>
          </p>
        </Section>

      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '2.5rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-formula)',
        fontSize: 'clamp(1.3rem, 3vw, 2rem)',
        borderBottom: '3px solid #000',
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
      }}>
        {title.toUpperCase()}
      </h2>
      {children}
    </section>
  );
}

function YearTable() {
  const years = [
    { year: 2022, count: '1 944' },
    { year: 2023, count: '1 981' },
    { year: 2024, count: '2 048' },
    { year: 2025, count: '2 290' },
    { year: 2026, count: '1 144' },
  ];

  return (
    <table style={{
      borderCollapse: 'collapse',
      width: '100%',
      maxWidth: '300px',
      marginTop: '1rem',
      fontSize: '0.95rem',
    }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', borderBottom: '2px solid #000', padding: '0.4rem 1rem 0.4rem 0' }}>År</th>
          <th style={{ textAlign: 'right', borderBottom: '2px solid #000', padding: '0.4rem 0' }}>Events</th>
        </tr>
      </thead>
      <tbody>
        {years.map((y) => (
          <tr key={y.year}>
            <td style={{ padding: '0.3rem 1rem 0.3rem 0', borderBottom: '1px solid #ccc' }}>{y.year}</td>
            <td style={{ textAlign: 'right', padding: '0.3rem 0', borderBottom: '1px solid #ccc' }}>{y.count}</td>
          </tr>
        ))}
        <tr>
          <td style={{ padding: '0.3rem 1rem 0.3rem 0', fontWeight: 700 }}>Totalt</td>
          <td style={{ textAlign: 'right', padding: '0.3rem 0', fontWeight: 700 }}>9 407</td>
        </tr>
      </tbody>
    </table>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Integritetspolicy',
  robots: { index: false, follow: false },
};

export default function IntegritetspolicyPage() {
  const sectionStyle = { marginBottom: '2rem' };
  const h2Style = { fontSize: '1.25rem', fontWeight: 700 as const, marginBottom: '0.5rem' };
  const pStyle = { fontSize: '0.95rem', lineHeight: 1.7, color: '#333', marginBottom: '0.75rem' };

  return (
    <div style={{ backgroundColor: '#f7f5e4', minHeight: '100vh' }}>
      <header style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '2rem 0',
        borderBottom: '4px solid #ff6632',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 2rem' }}>
          <a href="/" style={{ color: '#fff', textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-formula)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)' }}>
              ALMEDALSDATA
            </span>
          </a>
          <p style={{ fontSize: '0.9rem', opacity: 0.6, marginTop: '0.5rem' }}>
            Integritetspolicy
          </p>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Personuppgiftsansvarig</h2>
          <p style={pStyle}>
            Reform Society Company i Stockholm AB<br />
            Org.nr 556866-8973<br />
            Hornsgatan 54, 118 21 Stockholm<br />
            <a href="mailto:jakob.ohlsson@reformsociety.se" style={{ color: '#ff6632', textDecoration: 'none' }}>
              jakob.ohlsson@reformsociety.se
            </a>
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Vilka uppgifter behandlar vi?</h2>
          <p style={pStyle}>
            Almedalsdata samlar in och analyserar information om Almedalsveckans offentliga program
            under perioden 2022 till 2026. De personuppgifter som behandlas avser personer som
            medverkat som talare, paneldeltagare eller arrangörer vid offentliga seminarier och
            programpunkter. Uppgifterna omfattar namn, yrkestitel, organisationstillhörighet samt
            uppgifter om vilka seminarier personen medverkat i.
          </p>
          <p style={pStyle}>
            All data har hämtats från offentligt tillgängliga källor: Almedalsveckans officiella
            webbkalendarium och tryckta programkataloger.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Syfte</h2>
          <p style={pStyle}>
            Uppgifterna behandlas i syfte att tillhandahålla analyser och visualiseringar av
            Almedalsveckans program. Detta inkluderar kartläggning av aktörer, ämneskluster,
            nätverksanalys och trendanalys. Tjänsten riktar sig till organisationer, journalister
            och andra aktörer med intresse av att förstå Almedalsveckans struktur och utveckling.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Rättslig grund</h2>
          <p style={pStyle}>
            Behandlingen baseras på berättigat intresse enligt artikel 6.1(f) i EU:s
            dataskyddsförordning (GDPR). Vårt berättigade intresse är att tillhandahålla
            samhällsanalys baserad på offentligt tillgänglig information om offentliga
            personers medverkan i offentliga arrangemang.
          </p>
          <p style={pStyle}>
            Vi bedömer att den registrerades intressen inte väger tyngre, eftersom uppgifterna
            redan är offentliga, avser professionell verksamhet i offentliga sammanhang, och
            behandlingen inte medför någon oväntad eller oproportionerlig integritetspåverkan.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Lagringstid</h2>
          <p style={pStyle}>
            Uppgifterna lagras så länge de är relevanta för det angivna syftet. Data från
            tidigare års program behålls för att möjliggöra trendanalyser och jämförelser
            över tid.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Dina rättigheter</h2>
          <p style={pStyle}>
            Som registrerad har du följande rättigheter:
          </p>
          <ul style={{ ...pStyle, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <li><strong>Rätt till tillgång</strong> — Du kan begära att få veta vilka uppgifter vi behandlar om dig.</li>
            <li><strong>Rätt till rättelse</strong> — Du kan begära att felaktiga uppgifter korrigeras.</li>
            <li><strong>Rätt till radering</strong> — Du kan begära att dina uppgifter raderas.</li>
            <li><strong>Rätt att invända</strong> — Du kan invända mot behandling som grundar sig på berättigat intresse. Vi kommer då att göra en ny intresseavvägning.</li>
            <li><strong>Rätt till begränsning</strong> — Du kan begära att behandlingen begränsas under tiden en invändning prövas.</li>
          </ul>
          <p style={pStyle}>
            Kontakta oss på{' '}
            <a href="mailto:jakob.ohlsson@reformsociety.se" style={{ color: '#ff6632', textDecoration: 'none' }}>
              jakob.ohlsson@reformsociety.se
            </a>{' '}
            för att utöva dina rättigheter. Vi besvarar din förfrågan inom 30 dagar.
          </p>
        </div>

        <div style={sectionStyle}>
          <h2 style={h2Style}>Klagomål</h2>
          <p style={pStyle}>
            Om du anser att vi behandlar dina personuppgifter i strid med GDPR har du rätt att
            lämna klagomål till Integritetsskyddsmyndigheten (IMY).
          </p>
          <p style={pStyle}>
            Integritetsskyddsmyndigheten<br />
            Box 8114, 104 20 Stockholm<br />
            <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" style={{ color: '#ff6632', textDecoration: 'none' }}>
              www.imy.se
            </a>
          </p>
        </div>

        <div style={{ ...sectionStyle, borderTop: '1px solid #ccc', paddingTop: '1.5rem' }}>
          <p style={{ ...pStyle, fontSize: '0.85rem', color: '#666' }}>
            Denna policy uppdaterades senast den 26 mars 2026.
          </p>
        </div>

      </main>
    </div>
  );
}

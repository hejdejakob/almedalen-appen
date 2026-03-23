export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: '#000',
        color: '#fff',
        padding: '3rem 0 2rem',
        marginTop: '3rem',
      }}
    >
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 2rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '2rem 4rem',
        justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div>
          <a
            href="https://reformsociety.se"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--font-formula)',
              fontSize: '1.5rem',
              color: '#fff',
              textDecoration: 'none',
              letterSpacing: '0.05em',
            }}
          >
            REFORM SOCIETY
          </a>
          <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem' }}>
            Almedalsdata 2022–2026
          </div>
        </div>

        {/* Contact */}
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: '#ccc' }}>
          <div>Hornsgatan 54, 118 21 Stockholm</div>
          <div>
            <a href="mailto:info@reformsociety.se" style={{ color: '#ff6632', textDecoration: 'none' }}>
              info@reformsociety.se
            </a>
          </div>
          <div>08-410 670 50</div>
        </div>

        {/* Links */}
        <div style={{ fontSize: '0.85rem', lineHeight: 1.8, color: '#ccc' }}>
          <div>
            <a
              href="https://www.linkedin.com/company/reform-society/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#ccc', textDecoration: 'none' }}
            >
              LinkedIn ↗
            </a>
          </div>
          <div>
            <a href="https://reformsociety.se" target="_blank" rel="noopener noreferrer" style={{ color: '#ccc', textDecoration: 'none' }}>
              reformsociety.se ↗
            </a>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div style={{
        maxWidth: '1400px',
        margin: '2rem auto 0',
        padding: '1rem 2rem 0',
        borderTop: '1px solid #333',
        fontSize: '0.75rem',
        color: '#666',
      }}>
        © {new Date().getFullYear()} Reform Society
      </div>
    </footer>
  );
}

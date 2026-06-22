import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#000',
          padding: '60px 80px',
        }}
      >
        {/* Top */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 400,
              color: '#fff',
              opacity: 0.5,
              letterSpacing: '6px',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            Reform Society
          </div>
          <div
            style={{
              fontSize: '110px',
              fontWeight: 900,
              color: '#fb531a',
              letterSpacing: '-2px',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            ALMEDALSDATA
          </div>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 600,
              color: '#fff',
              lineHeight: 1.3,
            }}
          >
            Vem driver agendan i Almedalen?
          </div>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
            }}
          >
            {['2022–2026', '9 400+ seminarier', '16 500+ talare', '3 000+ aktörer'].map(
              (item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                  }}
                >
                  {i > 0 && (
                    <div
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#fb531a',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '22px',
                      color: '#fff',
                      opacity: 0.6,
                    }}
                  >
                    {item}
                  </span>
                </div>
              )
            )}
          </div>
          {/* Orange accent line */}
          <div style={{ width: '120px', height: '4px', backgroundColor: '#fb531a' }} />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

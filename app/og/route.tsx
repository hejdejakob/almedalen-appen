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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <div
            style={{
              fontSize: '120px',
              fontWeight: 900,
              color: '#ff6632',
              letterSpacing: '-2px',
              lineHeight: 1,
              textTransform: 'uppercase',
            }}
          >
            ALMEDALSDATA
          </div>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 400,
              color: '#fff',
              opacity: 0.7,
              letterSpacing: '4px',
              textTransform: 'uppercase',
            }}
          >
            Reform Society
          </div>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              marginTop: '20px',
            }}
          >
            {['2022–2026', 'Makt', 'Amnen', 'Natverk', 'Sentiment'].map(
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
                        backgroundColor: '#ff6632',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: '24px',
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
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

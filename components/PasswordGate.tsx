'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CORRECT_PASSWORD = 'ReformSociety2026';
const STORAGE_KEY = 'rs-auth';

// Pages that are PUBLIC (no password)
const PUBLIC_PATHS = ['/', '/om', '/dashboard', '/arenaguiden', '/integritetspolicy'];

const SELL_POINTS = [
  'Sök bland 16 500+ talare och 3 000+ organisationer',
  'GAL\u2013TAN-analys på aktörer, talare och panelister',
  'Få koll på ditt nätverk, och ditt nätverks nätverk',
  'Kartlägg vem som äger agendan i Almedalen',
  'Utforska 21 ämneskluster och politiska profiler',
];

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === CORRECT_PASSWORD) {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  // Public pages — no gate
  if (isPublic) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, CORRECT_PASSWORD);
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (checking) return null;
  if (authed) return <>{children}</>;

  // Paywall overlay — content renders behind blurred backdrop
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Render actual page content behind the overlay */}
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
        {children}
      </div>

      {/* Dark overlay */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(2px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        overflowY: 'auto',
      }}>
        {/* Lightbox */}
        <div style={{
          backgroundColor: '#000',
          border: '2px solid #ff6632',
          borderRadius: '8px',
          boxShadow: '0 0 60px rgba(255, 102, 50, 0.2)',
          padding: 'clamp(1.25rem, 3vw, 2.5rem)',
          maxWidth: '440px',
          width: '100%',
          textAlign: 'center',
          color: '#fff',
          maxHeight: 'calc(100vh - 1.5rem)',
          overflowY: 'auto',
        }}>
          {/* Brand */}
          <div style={{
            fontFamily: 'var(--font-formula)',
            fontSize: 'clamp(1.2rem, 4vw, 1.8rem)',
            color: '#ff6632',
            marginBottom: '0.15rem',
            letterSpacing: '0.05em',
          }}>
            ALMEDALSDATA
          </div>
          <div style={{
            fontSize: 'clamp(0.65rem, 1.5vw, 0.8rem)',
            color: '#666',
            marginBottom: 'clamp(0.75rem, 2vw, 1.5rem)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            av Reform Society
          </div>

          {/* Selling points */}
          <div style={{
            textAlign: 'left',
            marginBottom: 'clamp(0.75rem, 2vw, 1.5rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'clamp(0.35rem, 1vw, 0.6rem)',
          }}>
            {SELL_POINTS.map((point, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                fontSize: 'clamp(0.75rem, 2vw, 0.85rem)',
                color: '#ccc',
                lineHeight: 1.4,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#ff6632', flexShrink: 0, marginTop: '5px' }} />
                {point}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #333', margin: '0 0 clamp(0.75rem, 2vw, 1.25rem)' }} />

          {/* Password form */}
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.6rem',
          }}>
            <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.85rem)', color: '#999' }}>
              Ange lösenord för att låsa upp
            </div>
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Lösenord"
              autoFocus
              style={{
                padding: '0.65rem 1rem',
                fontSize: '1rem',
                border: error ? '2px solid #e63946' : '2px solid #333',
                borderRadius: '4px',
                backgroundColor: '#111',
                color: '#fff',
                width: '100%',
                maxWidth: '280px',
                textAlign: 'center',
                fontFamily: 'inherit',
              }}
            />
            {error && (
              <div style={{ color: '#e63946', fontSize: '0.8rem' }}>Fel lösenord</div>
            )}
            <button type="submit" style={{
              padding: '0.6rem 2rem',
              backgroundColor: '#ff6632',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              width: '100%',
              maxWidth: '280px',
            }}>
              Öppna
            </button>
          </form>

          {/* Contact CTA */}
          <div style={{
            marginTop: 'clamp(0.75rem, 2vw, 1.25rem)',
            padding: '0.6rem',
            backgroundColor: 'rgba(255, 102, 50, 0.08)',
            borderRadius: '6px',
            fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)',
            color: '#999',
            lineHeight: 1.5,
          }}>
            Ingen tillgång?{' '}
            <a href="mailto:jakob.ohlsson@reformsociety.se" style={{ color: '#ff6632', textDecoration: 'none', fontWeight: 600 }}>
              Kontakta Jakob Ohlsson
            </a>
          </div>

          {/* Privacy link */}
          <div style={{ marginTop: '0.75rem' }}>
            <a href="/integritetspolicy" style={{ color: '#555', fontSize: '0.65rem', textDecoration: 'none' }}>
              Integritetspolicy
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

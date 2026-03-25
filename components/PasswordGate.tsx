'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

const CORRECT_PASSWORD = 'ReformSociety2026';
const STORAGE_KEY = 'rs-auth';

// Pages that are PUBLIC (no password)
const PUBLIC_PATHS = ['/', '/om', '/dashboard', '/arenaguiden'];

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

  return (
    <div style={{
      backgroundColor: '#000',
      color: '#fff',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
      }}>
        <div style={{
          fontFamily: 'var(--font-formula)',
          fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
          color: '#ff6632',
          marginBottom: '0.5rem',
        }}>
          REFORM SOCIETY
        </div>
        <div style={{ fontSize: '0.9rem', color: '#666' }}>
          Ange lösenord för att fortsätta
        </div>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          placeholder="Lösenord"
          autoFocus
          style={{
            padding: '0.75rem 1.25rem',
            fontSize: '1rem',
            border: error ? '2px solid #e63946' : '2px solid #333',
            borderRadius: '4px',
            backgroundColor: '#111',
            color: '#fff',
            width: '280px',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        />
        {error && (
          <div style={{ color: '#e63946', fontSize: '0.85rem' }}>Fel lösenord</div>
        )}
        <button type="submit" style={{
          padding: '0.6rem 2rem',
          backgroundColor: '#ff6632',
          color: '#fff',
          border: 'none',
          fontSize: '0.9rem',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}>
          Öppna
        </button>
      </form>
    </div>
  );
}

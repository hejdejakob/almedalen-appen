import { NextRequest, NextResponse } from 'next/server';

// HTTP Basic Auth-skydd för talarsidan och dess privata API:er.
// Lösenordet ligger i env-variabeln SPEAKERS_PASSWORD (sätts lokalt i .env
// och i Vercel). Användarnamnet ignoreras, endast lösenordet kontrolleras.
// /api/dashboard gatas INTE: det delas av publika sidor (start, pensioner,
// arenaguiden, dashboard). Kundrapporten /sakerhetsarenan är publik (öppnad
// på beställning) och gatas därför inte längre.

const REALM = 'Almedalsdata - skyddat';

function unauthorized() {
  return new NextResponse('Autentisering krävs.', {
    status: 401,
    headers: { 'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"` },
  });
}

export function middleware(req: NextRequest) {
  const expected = process.env.SPEAKERS_PASSWORD;

  // Fail closed: om lösenordet inte är konfigurerat, neka hellre än att
  // exponera datan av misstag.
  if (!expected) return unauthorized();

  const header = req.headers.get('authorization');
  if (!header || !header.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  // Format: "användarnamn:lösenord" — vi bryr oss bara om lösenordet.
  const password = decoded.slice(decoded.indexOf(':') + 1);
  if (password !== expected) return unauthorized();

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/speakers',
    '/speakers/:path*',
    '/api/speakers',
    '/api/speakers/:path*',
    '/api/arrangers',
    '/api/arrangers/:path*',
    '/api/schedule',
    '/api/schedule/:path*',
  ],
};

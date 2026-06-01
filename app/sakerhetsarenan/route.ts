import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Kundrapporten serveras via en route (inte som statisk public/-fil) så att
// middleware.ts kan lösenordsskydda den. Statiska public/-filer kringgår
// middleware i Next.js och kan därför inte gatas.
export const dynamic = 'force-dynamic';

const html = readFileSync(join(process.cwd(), 'app/sakerhetsarenan/content.html'), 'utf-8');

export function GET() {
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

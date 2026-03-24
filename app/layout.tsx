import type { Metadata } from "next";
import "./globals.css";
import PasswordGate from "@/components/PasswordGate";

export const metadata: Metadata = {
  metadataBase: new URL("https://almedalsdata.se"),
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  title: {
    default: "Almedalsdata | Reform Society",
    template: "%s | Almedalsdata",
  },
  description:
    "9 400+ seminarier, 16 500+ talare, 3 000+ arrangörer — Almedalsveckan 2022–2026 i siffror. Sök talare, utforska ämnen, kartlägg aktörer och arenor.",
  openGraph: {
    title: "Almedalsdata | Reform Society",
    description: "9 400+ seminarier, 16 500+ talare, 3 000+ arrangörer — Almedalsveckan 2022–2026 i siffror. Sök talare, utforska ämnen, kartlägg aktörer och arenor.",
    url: "https://almedalsdata.se",
    siteName: "Almedalsdata",
    images: [{ url: "/og", width: 1200, height: 630 }],
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Almedalsdata | Reform Society",
    description: "9 400+ seminarier, 16 500+ talare, 3 000+ arrangörer — Almedalsveckan 2022–2026 i siffror.",
    images: ["/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: "Formula Condensed";
                src: url("https://cdn.prod.website-files.com/655f8df68b0ae90041cc428e/65604bffdd7be783795a68d6_FormulaCondensed_RS_WWW_Bold.otf") format("opentype");
                font-weight: 700;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: "Inter";
                src: url("https://cdn.prod.website-files.com/655f8df68b0ae90041cc428e/656077396f9fb7026ad51051_Inter-VariableFont_slnt%2Cwght.ttf") format("truetype");
                font-weight: 100 900;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: "Space Mono";
                src: url("https://cdn.prod.website-files.com/655f8df68b0ae90041cc428e/693197cf985eda6fe3669d6b_SpaceMono-Regular.ttf") format("truetype");
                font-weight: 400;
                font-style: normal;
                font-display: swap;
              }
            `,
          }}
        />
        <script async src="https://plausible.io/js/pa-KXC7BZnslSIxyg39LxDRl.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
          }}
        />
      </head>
      <body>
        <PasswordGate>{children}</PasswordGate>
      </body>
    </html>
  );
}

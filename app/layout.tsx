import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ditt Almedalsprogram | Reform Society",
  description:
    "Svara på fem frågor och få ett personligt program för Almedalsveckan 2026 — skapat av AI.",
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
      </head>
      <body>{children}</body>
    </html>
  );
}

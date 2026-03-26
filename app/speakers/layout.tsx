import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talarsök, Aktörssök & Ämnessök",
  description: "Sök bland 16 500+ paneldeltagare och 3 000+ organisationer i Almedalsveckan 2022–2026. Hitta talare, utforska ämnen och kartlägg aktörer.",
  robots: { index: false, follow: false },
};

export default function SpeakersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

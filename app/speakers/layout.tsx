import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talare i Almedalen | Reform Society",
  description: "Sok bland 16 000+ talare i Almedalsveckan 2022–2025.",
};

export default function SpeakersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

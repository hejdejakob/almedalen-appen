import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Arenaguiden",
  description: "Almedalens 50+ arenor kartlagda. Se vilka organisationer, talare och ämnen som dominerar varje plats i Visby.",
};

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

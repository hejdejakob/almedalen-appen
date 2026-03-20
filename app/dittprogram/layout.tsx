import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ditt Almedalsprogram | Reform Society",
  description: "Svara pa fem fragor och fa ett personligt program for Almedalsveckan 2026.",
};

export default function DittProgramLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

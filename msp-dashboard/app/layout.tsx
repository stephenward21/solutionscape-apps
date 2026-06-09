import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSP Compliance Dashboard — Drata GRC Toolkit",
  description:
    "Single-pane-of-glass internal dashboard for monitoring all client Drata compliance accounts",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audit Readiness Validator | Solutionscape",
  description: "Validate compliance evidence against Drata controls with Claude AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

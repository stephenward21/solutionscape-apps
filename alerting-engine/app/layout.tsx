import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Alerting Engine | Solutionscape",
  description: "Real-time compliance alerts to Slack, Jira, and webhooks",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}

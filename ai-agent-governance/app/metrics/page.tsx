import { Suspense } from "react";
import type { Metadata } from "next";
import MetricsPanel from "@/components/MetricsPanel";

export const metadata: Metadata = {
  title: "Metrics | SolutionScape AI Governance",
};

export default function MetricsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <Suspense>
          <MetricsPanel />
        </Suspense>
      </div>
    </div>
  );
}

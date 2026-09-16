import { Suspense } from "react";
import type { Metadata } from "next";
import SettingsPanel from "@/components/SettingsPanel";

export const metadata: Metadata = {
  title: "Settings | SolutionScape AI Governance",
};

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <Suspense>
          <SettingsPanel />
        </Suspense>
      </div>
    </div>
  );
}

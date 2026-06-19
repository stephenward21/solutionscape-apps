"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PolicyPanel from "./PolicyPanel";
import IdPPanel from "./IdPPanel";
import ReportPanel from "./ReportPanel";

type Tab = "policy" | "idp" | "report";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "policy", label: "AI Policy",        icon: "📄" },
  { key: "idp",    label: "Directory",         icon: "🔌" },
  { key: "report", label: "Compliance Report", icon: "📊" },
];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) ?? "policy"
  );

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-800 leading-tight">AI Agent Governance</div>
                <div className="text-xs text-slate-400">Solutionscape</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Tab nav */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6">
          <nav className="flex border-b border-slate-100 px-4">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="p-6">
            {activeTab === "policy" && <PolicyPanel />}
            {activeTab === "idp"    && <IdPPanel />}
            {activeTab === "report" && <ReportPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import PolicyPanel from "./PolicyPanel";
import IdPPanel from "./IdPPanel";
import ReportPanel from "./ReportPanel";
import BasicScanPanel from "./BasicScanPanel";
import type { PolicyAnalysisResult, UserActivity } from "@/lib/types";

type Mode = "basic" | "full";
type FullTab = "policy" | "idp" | "report";

const FULL_TABS: { key: FullTab; label: string; step: number }[] = [
  { key: "policy", label: "AI Policy",        step: 1 },
  { key: "idp",    label: "Directory",         step: 2 },
  { key: "report", label: "Compliance Report", step: 3 },
];

export default function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initTab = searchParams.get("tab");
  const initMode: Mode =
    initTab === "policy" || initTab === "idp" || initTab === "report" ? "full" : "basic";

  const [mode, setMode] = useState<Mode>(initMode);
  const [fullTab, setFullTab] = useState<FullTab>(
    (initTab as FullTab | null) && ["policy", "idp", "report"].includes(initTab!)
      ? (initTab as FullTab)
      : "policy"
  );

  const [policyResult, setPolicyResult] = useState<PolicyAnalysisResult | null>(null);
  const [idpUsers, setIdpUsers]         = useState<UserActivity[]>([]);

  function switchMode(m: Mode) {
    setMode(m);
    router.replace(`/dashboard?tab=${m === "basic" ? "discovery" : fullTab}`, { scroll: false });
  }

  function switchFullTab(tab: FullTab) {
    setFullTab(tab);
    router.replace(`/dashboard?tab=${tab}`, { scroll: false });
  }

  const policyDone = policyResult !== null;
  const idpDone    = idpUsers.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-16 gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0">
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
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* ── Mode selector ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Basic — AI Discovery */}
          <button
            onClick={() => switchMode("basic")}
            className={`text-left rounded-2xl border-2 p-5 transition-all ${
              mode === "basic"
                ? "border-violet-500 bg-violet-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                mode === "basic" ? "bg-violet-100" : "bg-slate-100"
              }`}>
                🔍
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${mode === "basic" ? "text-violet-700" : "text-slate-800"}`}>
                    AI Discovery
                  </span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                    Quick start
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  See every AI tool your team is using, what it does, and how risky it is.
                  No policy needed — ideal if you&apos;re just getting started.
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {["Connect directory", "AI tool inventory", "Risk scores"].map((t) => (
                    <span key={t} className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {mode === "basic" && (
              <div className="mt-3 pt-3 border-t border-violet-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                <span className="text-xs font-medium text-violet-600">Active</span>
              </div>
            )}
          </button>

          {/* Full — AI Policy Compliance */}
          <button
            onClick={() => switchMode("full")}
            className={`text-left rounded-2xl border-2 p-5 transition-all ${
              mode === "full"
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                mode === "full" ? "bg-brand-100" : "bg-slate-100"
              }`}>
                📋
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${mode === "full" ? "text-brand-700" : "text-slate-800"}`}>
                    Policy Compliance Review
                  </span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                    3 steps
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Upload your AI acceptable use policy, connect your directory, and get a
                  per-user compliance report showing who is in breach and why.
                </p>
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {["Upload policy", "Connect directory", "Compliance report"].map((t, i) => (
                    <span key={t} className="flex items-center gap-1 text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                      <span className="text-slate-300 font-mono">{i + 1}</span>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {mode === "full" && (
              <div className="mt-3 pt-3 border-t border-brand-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                <span className="text-xs font-medium text-brand-600">Active</span>
              </div>
            )}
          </button>
        </div>

        {/* ── Content card ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">

          {/* Sub-tabs for the full compliance workflow only */}
          {mode === "full" && (
            <nav className="flex items-center border-b border-slate-100 px-4 gap-1">
              {FULL_TABS.map((tab, idx) => {
                const done = tab.key === "policy" ? policyDone : tab.key === "idp" ? idpDone : false;
                const isActive = fullTab === tab.key;
                return (
                  <div key={tab.key} className="flex items-center">
                    {/* Step connector */}
                    {idx > 0 && (
                      <svg className="w-4 h-4 text-slate-300 mx-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                    <button
                      onClick={() => switchFullTab(tab.key)}
                      className={`flex items-center gap-2 px-3 py-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
                        isActive
                          ? "border-brand-600 text-brand-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0 ${
                        done
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-brand-600 text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}>
                        {done
                          ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          : tab.step}
                      </span>
                      {tab.label}
                    </button>
                  </div>
                );
              })}
            </nav>
          )}

          <div className="p-6">
            {mode === "basic" && (
              <BasicScanPanel idpUsers={idpUsers} />
            )}
            {mode === "full" && fullTab === "policy" && (
              <PolicyPanel onAnalysisComplete={(result) => setPolicyResult(result)} />
            )}
            {mode === "full" && fullTab === "idp" && (
              <IdPPanel onConnected={(users) => setIdpUsers(users)} />
            )}
            {mode === "full" && fullTab === "report" && (
              <ReportPanel policyResult={policyResult} idpUsers={idpUsers} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

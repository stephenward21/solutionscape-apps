"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import PolicyPanel from "./PolicyPanel";
import IdPPanel from "./IdPPanel";
import ReportPanel from "./ReportPanel";
import BasicScanPanel from "./BasicScanPanel";
import type { PolicyAnalysisResult, UserActivity, IdPProvider } from "@/lib/types";

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
  const modeParam = searchParams.get("mode");
  const hideSelector = !!modeParam;
  const initMode: Mode =
    modeParam === "compliance" || initTab === "policy" || initTab === "idp" || initTab === "report"
      ? "full"
      : "basic";

  const [mode, setMode] = useState<Mode>(initMode);
  const [fullTab, setFullTab] = useState<FullTab>(
    (initTab as FullTab | null) && ["policy", "idp", "report"].includes(initTab!)
      ? (initTab as FullTab)
      : "policy"
  );

  const [policyResult, setPolicyResult]       = useState<PolicyAnalysisResult | null>(null);
  const [idpUsers, setIdpUsers]               = useState<UserActivity[]>([]);
  const [activeProvider, setActiveProvider]   = useState<IdPProvider | undefined>();
  const [activeCredentials, setActiveCredentials] = useState<Record<string, string> | undefined>();

  // On macOS Electron the traffic-light buttons (close/minimize/expand) overlay
  // the top-left of the window. Push the header logo right to avoid the overlap.
  const [macElectronPadding, setMacElectronPadding] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.electronAPI) {
      // navigator.platform is deprecated but reliable for this check
      setMacElectronPadding(navigator.platform.startsWith("Mac"));
    }
  }, []);

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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20" style={macElectronPadding ? { WebkitAppRegion: "drag" } as React.CSSProperties : undefined}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className={`flex items-center h-16 gap-3 ${macElectronPadding ? "pl-20" : ""}`}>
            {/* SolutionScape hex logo mark */}
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <defs>
                <linearGradient id="ss-grad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2A8EC5" />
                  <stop offset="100%" stopColor="#2EB598" />
                </linearGradient>
              </defs>
              <polygon points="18,2.5 31,9.75 31,26.25 18,33.5 5,26.25 5,9.75" fill="url(#ss-grad)" />
              {/* Node network */}
              <circle cx="13" cy="18" r="2.2" fill="white" fillOpacity="0.92" />
              <circle cx="22" cy="13" r="2.2" fill="white" fillOpacity="0.92" />
              <circle cx="22" cy="23" r="2.2" fill="white" fillOpacity="0.92" />
              <line x1="13" y1="18" x2="22" y2="13" stroke="white" strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round" />
              <line x1="13" y1="18" x2="22" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round" />
              <line x1="22" y1="13" x2="22" y2="23" stroke="white" strokeWidth="1.5" strokeOpacity="0.75" strokeLinecap="round" />
            </svg>
            <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <div className="font-bold text-slate-900 leading-tight tracking-tight">SolutionScape</div>
              <div className="text-xs text-slate-400 font-medium">AI Agent Governance</div>
            </div>

            <div className="ml-auto flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
              <Link
                href="/metrics"
                title="Metrics"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </Link>
              <Link
                href="/settings"
                title="Settings"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">

        {/* ── Mode selector (hidden when navigating from homepage) ──────── */}
        {hideSelector && (
          <div className="flex items-center gap-2">
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Home
            </Link>
            <span className="text-slate-200">/</span>
            <span className="text-xs text-slate-500 font-medium">
              {mode === "basic" ? "AI Discovery" : "Policy Compliance"}
            </span>
          </div>
        )}
        {!hideSelector && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Basic — AI Discovery */}
          <button
            onClick={() => switchMode("basic")}
            className={`text-left rounded-2xl border-2 p-5 transition-all ${
              mode === "basic"
                ? "border-teal-500 bg-teal-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl ${
                mode === "basic" ? "bg-teal-100" : "bg-slate-100"
              }`}>
                🔍
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-sm font-semibold ${mode === "basic" ? "text-teal-700" : "text-slate-800"}`}>
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
              <div className="mt-3 pt-3 border-t border-teal-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span className="text-xs font-medium text-teal-600">Active</span>
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
        </div>}

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
              <div className="space-y-4">
                {/* Step 1: Connect directory — collapses once connected */}
                <div className={`rounded-xl border transition-all ${
                  idpDone
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-slate-200 bg-white"
                }`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      idpDone ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {idpDone
                        ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        : "1"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${idpDone ? "text-emerald-700" : "text-slate-700"}`}>
                        {idpDone
                          ? `Directory connected — ${idpUsers.length} users synced`
                          : "Connect your identity provider"}
                      </p>
                      {!idpDone && (
                        <p className="text-xs text-slate-400">Google Workspace, Microsoft Entra, or Okta</p>
                      )}
                    </div>
                    {idpDone && (
                      <button
                        onClick={() => { setIdpUsers([]); setActiveProvider(undefined); setActiveCredentials(undefined); }}
                        className="text-xs text-emerald-600 hover:text-emerald-800 underline shrink-0"
                      >
                        Reconnect
                      </button>
                    )}
                  </div>
                  {!idpDone && (
                    <div className="border-t border-slate-100 p-4">
                      <IdPPanel onConnected={(users, provider, creds) => {
                        setIdpUsers(users);
                        setActiveProvider(provider);
                        setActiveCredentials(creds);
                      }} />
                    </div>
                  )}
                </div>

                {/* Step 2: AI Discovery Scan */}
                <div className={`rounded-xl border ${
                  idpDone ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-60 pointer-events-none"
                }`}>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      idpDone ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-400"
                    }`}>
                      2
                    </span>
                    <p className="text-sm font-medium text-slate-700">Run AI Discovery Scan</p>
                  </div>
                  <div className="p-4">
                    <BasicScanPanel
                      idpUsers={idpUsers}
                      provider={activeProvider}
                      credentials={activeCredentials}
                    />
                  </div>
                </div>
              </div>
            )}
            {mode === "full" && fullTab === "policy" && (
              <PolicyPanel onAnalysisComplete={(result) => setPolicyResult(result)} />
            )}
            {mode === "full" && fullTab === "idp" && (
              <IdPPanel onConnected={(users, provider, creds) => {
              setIdpUsers(users);
              setActiveProvider(provider);
              setActiveCredentials(creds);
            }} />
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

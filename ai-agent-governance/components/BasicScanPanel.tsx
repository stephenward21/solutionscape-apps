"use client";

import { useState, useEffect } from "react";
import type { BasicAIReport, AIToolProfile, AIRiskLevel, UserActivity, IdPProvider } from "@/lib/types";
import type { OrgVerticalConfig } from "@/lib/verticals";
import { loadOrgConfig } from "./VerticalConfigPanel";
import { saveScanReport } from "@/lib/scan-history";
import { VERTICAL_DEFINITIONS } from "@/lib/verticals";
import NotificationsPanel from "./NotificationsPanel";
import RevokePanel from "./RevokePanel";

const RISK_CONFIG: Record<AIRiskLevel, { label: string; badge: string; bar: string; dot: string; border: string }> = {
  CRITICAL: { label: "Critical",  badge: "bg-rose-100 text-rose-700",    bar: "bg-rose-500",    dot: "bg-rose-500",    border: "border-rose-200" },
  HIGH:     { label: "High",      badge: "bg-orange-100 text-orange-700", bar: "bg-orange-500",  dot: "bg-orange-500",  border: "border-orange-200" },
  MEDIUM:   { label: "Medium",    badge: "bg-amber-100 text-amber-700",   bar: "bg-amber-400",   dot: "bg-amber-400",   border: "border-amber-200" },
  LOW:      { label: "Low",       badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-400", dot: "bg-emerald-400", border: "border-emerald-200" },
};

interface BasicScanPanelProps {
  idpUsers: UserActivity[];
  provider?: IdPProvider;
  credentials?: Record<string, string>;
}

export default function BasicScanPanel({ idpUsers, provider, credentials }: BasicScanPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BasicAIReport | null>(null);
  const [filter, setFilter] = useState<AIRiskLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [orgConfig, setOrgConfig] = useState<OrgVerticalConfig | null>(null);

  useEffect(() => {
    setOrgConfig(loadOrgConfig());
  }, []);

  async function runScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/basic-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: idpUsers, orgConfig: orgConfig ?? undefined }),
      });
      const data = await res.json() as BasicAIReport & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Scan failed");
      setReport(data);
      // Persist to localStorage so Metrics page shows history in web context
      if (typeof window !== "undefined") {
        if (window.electronAPI) {
          // Persist to SQLite via Electron IPC so Metrics page can read it
          await window.electronAPI.reports.save(data);
        } else {
          saveScanReport(data);
          window.dispatchEvent(new CustomEvent("ss:scan-saved"));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = (report?.toolProfiles ?? []).filter((p) => {
    const levelMatch = filter === "all" || p.riskLevel === filter;
    const low = search.toLowerCase();
    const searchMatch =
      !search ||
      p.tool.toLowerCase().includes(low) ||
      p.vendor.toLowerCase().includes(low) ||
      p.category.toLowerCase().includes(low);
    return levelMatch && searchMatch;
  });

  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">AI Discovery Scan</h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Don&apos;t have an AI policy yet? Start here. This scan identifies every AI tool
            your employees are actively using, researches what each one does, and scores
            the risk — giving you a clear picture of your AI landscape before writing a single policy rule.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm font-semibold text-slate-700 mb-1">Scan your AI landscape</p>

          <div className="inline-flex flex-col gap-2 text-left mb-5 mt-2">
            <InfoRow
              done={idpUsers.length > 0}
              label={
                idpUsers.length > 0
                  ? `Directory connected — ${idpUsers.length} users with AI activity`
                  : "Connect your identity provider above"
              }
            />
            <InfoRow done label="Web research — automatically looks up unfamiliar apps" />
            <InfoRow
              done={!!orgConfig && orgConfig.vertical !== "general"}
              label={
                orgConfig && orgConfig.vertical !== "general"
                  ? `${VERTICAL_DEFINITIONS[orgConfig.vertical].icon} ${VERTICAL_DEFINITIONS[orgConfig.vertical].label} vertical — regulation-cited risk analysis`
                  : "Industry profile — configure in Settings for regulation-cited scoring"
              }
            />
            <InfoRow done label="Risk scoring — based on AI type and data access level" />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 mb-4 text-left max-w-md mx-auto">
              {error}
            </div>
          )}

          <button
            onClick={() => { void runScan(); }}
            disabled={loading || idpUsers.length === 0}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Researching AI tools…
              </>
            ) : (
              "Run AI Discovery Scan"
            )}
          </button>

          {loading && (
            <p className="text-xs text-slate-400 mt-3">
              Looking up each tool, checking websites, scoring risks — this takes 30–90 seconds.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-800">AI Discovery Report</h2>
            {orgConfig && orgConfig.vertical !== "general" && (
              <span className="text-xs bg-brand-100 text-brand-700 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
                {VERTICAL_DEFINITIONS[orgConfig.vertical].icon} {VERTICAL_DEFINITIONS[orgConfig.vertical].label}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Generated {new Date(report.generatedAt).toLocaleString()} · {report.totalUsersScanned} users scanned
            {orgConfig?.frameworks.length ? ` · ${orgConfig.frameworks.length} frameworks applied` : ""}
          </p>
        </div>
        <button
          onClick={() => { setReport(null); }}
          className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          Re-scan
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIBox label="AI Tools Found"  value={report.totalAIToolsFound} color="text-slate-700"   bg="bg-slate-50" />
        <KPIBox label="Critical Risk"   value={report.criticalTools}     color="text-rose-600"    bg="bg-rose-50" />
        <KPIBox label="High Risk"       value={report.highRiskTools}     color="text-orange-600"  bg="bg-orange-50" />
        <KPIBox label="Users Scanned"   value={report.totalUsersScanned} color="text-brand-600"   bg="bg-brand-50" />
      </div>

      {/* Summary narrative */}
      {report.summary && (
        <div className="bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">AI Assessment Summary</p>
          <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Recommended Next Steps</p>
          <ol className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                  {i + 1}
                </span>
                {rec}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {(["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
            const cfg = lvl !== "all" ? RISK_CONFIG[lvl] : null;
            const count = lvl === "all"
              ? report.toolProfiles.length
              : report.toolProfiles.filter((p) => p.riskLevel === lvl).length;
            return (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === lvl
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {lvl === "all" ? "All" : cfg!.label}
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search tool, vendor, category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-48"
        />
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} shown</span>
      </div>

      {/* Tool cards */}
      <div className="space-y-3">
        {filtered.map((profile) => (
          <ToolCard key={profile.tool} profile={profile} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No tools match the current filter.</div>
        )}
      </div>

      {/* Action panels */}
      {(report.criticalTools > 0 || report.highRiskTools > 0) && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Take Action</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <NotificationsPanel report={report} idpUsers={idpUsers} />
          {provider && credentials && provider !== "manual" && (
            <RevokePanel idpUsers={idpUsers} provider={provider} credentials={credentials} />
          )}
        </div>
      )}
    </div>
  );
}

function ToolCard({ profile }: { profile: AIToolProfile }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RISK_CONFIG[profile.riskLevel];

  return (
    <div className={`border rounded-xl overflow-hidden bg-white ${cfg.border}`}>
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        {/* Risk dot */}
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

        {/* Tool info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label} Risk
            </span>
            <span className="text-sm font-semibold text-slate-800">{profile.tool}</span>
            <span className="text-xs text-slate-400">{profile.vendor}</span>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{profile.category}</span>
            {!profile.recognized && (
              <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Web-researched</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{profile.description}</p>
        </div>

        {/* Risk score + user count */}
        <div className="text-right shrink-0 mr-1">
          <div className={`text-sm font-bold ${
            profile.riskLevel === "CRITICAL" ? "text-rose-600" :
            profile.riskLevel === "HIGH" ? "text-orange-600" :
            profile.riskLevel === "MEDIUM" ? "text-amber-600" : "text-emerald-600"
          }`}>
            {profile.riskScore}
          </div>
          <p className="text-xs text-slate-400">{profile.userCount} user{profile.userCount !== 1 ? "s" : ""}</p>
        </div>

        {/* Risk bar */}
        <div className="w-16 shrink-0">
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${cfg.bar}`}
              style={{ width: `${profile.riskScore}%` }}
            />
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">What this tool does</p>
            <p className="text-sm text-slate-700">{profile.description}</p>
          </div>

          {/* AI Capabilities */}
          {profile.aiCapabilities.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">AI Capabilities</p>
              <ul className="space-y-1">
                {profile.aiCapabilities.map((c, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-700">
                    <span className="text-brand-500 shrink-0 mt-0.5">▸</span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk factors */}
          {profile.riskFactors.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">Risk Factors</p>
              <ul className="space-y-1">
                {profile.riskFactors.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className={`shrink-0 mt-0.5 ${cfg.dot.replace("bg-", "text-")}`}>⚠</span>
                    <span className="text-slate-700">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data access */}
            {profile.dataAccess.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Data / Systems Access</p>
                <div className="flex flex-wrap gap-1">
                  {profile.dataAccess.map((s, i) => (
                    <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {profile.userEmails.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">
                  Users ({profile.userCount})
                </p>
                <div className="space-y-1">
                  {profile.userEmails.slice(0, 8).map((email, i) => (
                    <p key={i} className="text-xs text-slate-500 truncate">{email}</p>
                  ))}
                  {profile.userEmails.length > 8 && (
                    <p className="text-xs text-slate-400">+{profile.userEmails.length - 8} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KPIBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function InfoRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-start gap-2">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
      )}
      <span className={`text-xs ${done ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}

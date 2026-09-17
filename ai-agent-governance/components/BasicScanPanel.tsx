"use client";

import { useState, useEffect, useMemo } from "react";
import type { BasicAIReport, AIToolProfile, AIRiskLevel, UserActivity, IdPProvider } from "@/lib/types";
import type { OrgVerticalConfig } from "@/lib/verticals";
import { loadOrgConfig } from "./VerticalConfigPanel";
import { saveScanReport } from "@/lib/scan-history";
import { VERTICAL_DEFINITIONS } from "@/lib/verticals";
import NotificationsPanel from "./NotificationsPanel";
import RevokePanel from "./RevokePanel";

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<AIRiskLevel, { label: string; badge: string; bar: string; dot: string; border: string; row: string }> = {
  CRITICAL: { label: "Critical",  badge: "bg-rose-100 text-rose-700",     bar: "bg-rose-500",    dot: "bg-rose-500",    border: "border-rose-300",   row: "bg-rose-50/40" },
  HIGH:     { label: "High",      badge: "bg-orange-100 text-orange-700", bar: "bg-orange-500",  dot: "bg-orange-500",  border: "border-orange-300", row: "bg-orange-50/40" },
  MEDIUM:   { label: "Medium",    badge: "bg-amber-100 text-amber-700",   bar: "bg-amber-400",   dot: "bg-amber-400",   border: "border-amber-200",  row: "bg-amber-50/30" },
  LOW:      { label: "Low",       badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-400", dot: "bg-emerald-400", border: "border-emerald-200", row: "" },
};

const RISK_ORDER: Record<AIRiskLevel, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

type ReportTab = "summary" | "apps" | "users";
type SortCol  = "risk" | "tool" | "users" | "score";

const PAGE_SIZE = 50;

// ─── Props ────────────────────────────────────────────────────────────────────

interface BasicScanPanelProps {
  idpUsers: UserActivity[];
  provider?: IdPProvider;
  credentials?: Record<string, string>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BasicScanPanel({ idpUsers, provider, credentials }: BasicScanPanelProps) {
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [report, setReport]     = useState<BasicAIReport | null>(null);
  const [orgConfig, setOrgConfig] = useState<OrgVerticalConfig | null>(null);

  // Report tabs & sorting
  const [tab, setTab]           = useState<ReportTab>("summary");
  const [appFilter, setAppFilter] = useState<AIRiskLevel | "all">("all");
  const [appSearch, setAppSearch] = useState("");
  const [sortCol, setSortCol]   = useState<SortCol>("risk");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage]     = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => { setOrgConfig(loadOrgConfig()); }, []);

  // ── Scan ──────────────────────────────────────────────────────────────────────

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
      setTab("summary");
      if (typeof window !== "undefined") {
        if (window.electronAPI) {
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

  // ── Derived data ──────────────────────────────────────────────────────────────

  // Map tool name → profile for user tab lookups
  const profileByTool = useMemo(() => {
    const m = new Map<string, AIToolProfile>();
    report?.toolProfiles.forEach((p) => m.set(p.tool.toLowerCase(), p));
    return m;
  }, [report]);

  // Sorted/filtered apps
  const sortedApps = useMemo(() => {
    if (!report) return [];
    const filtered = report.toolProfiles.filter((p) => {
      const lvl = appFilter === "all" || p.riskLevel === appFilter;
      const low = appSearch.toLowerCase();
      const txt = !appSearch || [p.tool, p.vendor, p.category].some((s) => s.toLowerCase().includes(low));
      return lvl && txt;
    });
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortCol === "risk")  diff = RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
      if (sortCol === "tool")  diff = a.tool.localeCompare(b.tool);
      if (sortCol === "users") diff = a.userCount - b.userCount;
      if (sortCol === "score") diff = a.riskScore - b.riskScore;
      return sortDir === "desc" ? -diff : diff;
    });
  }, [report, appFilter, appSearch, sortCol, sortDir]);

  // Users with their matched risk profiles
  const enrichedUsers = useMemo(() => {
    if (!report) return [];
    return idpUsers
      .filter((u) => u.aiToolsDetected.length > 0)
      .map((u) => {
        const tools = u.aiToolsDetected.map((t) => {
          const profile = profileByTool.get(t.tool.toLowerCase());
          return { ...t, riskLevel: profile?.riskLevel ?? "LOW" as AIRiskLevel, riskScore: profile?.riskScore ?? 0 };
        });
        const highestRisk = tools.reduce<AIRiskLevel>(
          (best, t) => RISK_ORDER[t.riskLevel] > RISK_ORDER[best] ? t.riskLevel : best,
          "LOW"
        );
        return { ...u, tools, highestRisk };
      })
      .sort((a, b) => RISK_ORDER[b.highestRisk] - RISK_ORDER[a.highestRisk]);
  }, [idpUsers, profileByTool, report]);

  const filteredUsers = useMemo(() => {
    const low = userSearch.toLowerCase();
    return !userSearch ? enrichedUsers : enrichedUsers.filter((u) =>
      u.email.toLowerCase().includes(low) || (u.displayName ?? "").toLowerCase().includes(low) || (u.department ?? "").toLowerCase().includes(low)
    );
  }, [enrichedUsers, userSearch]);

  const userPageCount = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const pagedUsers    = filteredUsers.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  // ── Pre-scan state ────────────────────────────────────────────────────────────

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
            <InfoRow done={idpUsers.length > 0} label={idpUsers.length > 0 ? `Directory connected — ${idpUsers.length} users with AI activity` : "Connect your identity provider above"} />
            <InfoRow done label="Web research — automatically looks up unfamiliar apps" />
            <InfoRow
              done={!!orgConfig && orgConfig.vertical !== "general"}
              label={orgConfig && orgConfig.vertical !== "general"
                ? `${VERTICAL_DEFINITIONS[orgConfig.vertical].icon} ${VERTICAL_DEFINITIONS[orgConfig.vertical].label} vertical — regulation-cited risk analysis`
                : "Industry profile — configure in Settings for regulation-cited scoring"}
            />
            <InfoRow done label="Risk scoring — based on AI type and data access level" />
          </div>
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 mb-4 text-left max-w-md mx-auto">{error}</div>
          )}
          <button
            onClick={() => { void runScan(); }}
            disabled={loading || idpUsers.length === 0}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            {loading ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Researching AI tools…</>
            ) : "Run AI Discovery Scan"}
          </button>
          {loading && <p className="text-xs text-slate-400 mt-3">Looking up each tool, checking websites, scoring risks — this takes 30–90 seconds.</p>}
        </div>
      </div>
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

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
        <KPIBox label="AI Tools Found"  value={report.totalAIToolsFound} color="text-slate-700"  bg="bg-slate-50" />
        <KPIBox label="Critical Risk"   value={report.criticalTools}     color="text-rose-600"   bg="bg-rose-50" />
        <KPIBox label="High Risk"       value={report.highRiskTools}     color="text-orange-600" bg="bg-orange-50" />
        <KPIBox label="Users Scanned"   value={report.totalUsersScanned} color="text-brand-600"  bg="bg-brand-50" />
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {([
            { key: "summary", label: "Assessment Summary" },
            { key: "apps",    label: `Identified Apps (${report.totalAIToolsFound})` },
            { key: "users",   label: `Users (${enrichedUsers.length})` },
          ] as { key: ReportTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Summary ── */}
      {tab === "summary" && (
        <div className="space-y-4">
          {report.summary && (
            <div className="bg-gradient-to-r from-brand-50 to-violet-50 border border-brand-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">AI Assessment Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
            </div>
          )}

          {report.recommendations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Recommended Next Steps</p>
              <ol className="space-y-3">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-700">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{rec}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Risk breakdown by category */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Risk Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as AIRiskLevel[]).map((lvl) => {
                const count = report.toolProfiles.filter((p) => p.riskLevel === lvl).length;
                const cfg   = RISK_CONFIG[lvl];
                return (
                  <button
                    key={lvl}
                    onClick={() => { setTab("apps"); setAppFilter(lvl); }}
                    className={`rounded-lg p-3 text-center border transition-colors hover:opacity-80 ${cfg.border} ${cfg.row || "bg-white"}`}
                  >
                    <p className={`text-2xl font-bold ${cfg.badge.split(" ")[1]}`}>{count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cfg.label} Risk</p>
                  </button>
                );
              })}
            </div>
            {/* Top categories */}
            <div>
              <p className="text-xs text-slate-500 mb-2">By category</p>
              <div className="space-y-1.5">
                {Object.entries(
                  report.toolProfiles.reduce<Record<string, number>>((acc, p) => {
                    acc[p.category] = (acc[p.category] ?? 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-2 text-xs text-slate-600">
                      <span className="w-28 truncate shrink-0">{cat}</span>
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full"
                          style={{ width: `${(count / report.totalAIToolsFound) * 100}%` }}
                        />
                      </div>
                      <span className="w-4 text-right">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Take Action */}
          {(report.criticalTools > 0 || report.highRiskTools > 0) && (
            <div className="space-y-3 pt-1">
              <Divider label="Take Action" />
              <NotificationsPanel report={report} idpUsers={idpUsers} />
              {provider && credentials && provider !== "manual" && (
                <RevokePanel idpUsers={idpUsers} provider={provider} credentials={credentials} />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Apps ── */}
      {tab === "apps" && (
        <div className="space-y-3">
          {/* Filter + search */}
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 flex-wrap">
              {(["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
                const count = lvl === "all"
                  ? report.toolProfiles.length
                  : report.toolProfiles.filter((p) => p.riskLevel === lvl).length;
                return (
                  <button
                    key={lvl}
                    onClick={() => setAppFilter(lvl)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      appFilter === lvl ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {lvl === "all" ? "All" : RISK_CONFIG[lvl].label}
                    <span className="ml-1 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search tool, vendor, category…"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-52"
            />
            <span className="text-xs text-slate-400 ml-auto">{sortedApps.length} apps</span>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <Th label="Risk"     col="risk"  sort={sortCol} dir={sortDir} onSort={toggleSort} className="w-28" />
                  <Th label="Tool"     col="tool"  sort={sortCol} dir={sortDir} onSort={toggleSort} />
                  <Th label="Vendor"   col={null}  sort={sortCol} dir={sortDir} onSort={toggleSort} className="hidden sm:table-cell text-slate-500 font-medium text-xs px-4 py-2.5 text-left" />
                  <Th label="Category" col={null}  sort={sortCol} dir={sortDir} onSort={toggleSort} className="hidden md:table-cell text-slate-500 font-medium text-xs px-4 py-2.5 text-left" />
                  <Th label="Users"    col="users" sort={sortCol} dir={sortDir} onSort={toggleSort} className="w-20 text-right" />
                  <Th label="Score"    col="score" sort={sortCol} dir={sortDir} onSort={toggleSort} className="w-24 text-right" />
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedApps.map((p) => {
                  const cfg = RISK_CONFIG[p.riskLevel];
                  const isExpanded = expandedApp === p.tool;
                  return (
                    <>
                      <tr
                        key={p.tool}
                        onClick={() => setExpandedApp(isExpanded ? null : p.tool)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${cfg.row}`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800 text-sm">{p.tool}</div>
                          <div className="text-xs text-slate-400 truncate max-w-xs">{p.description}</div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-600">{p.vendor}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{p.category}</span>
                          {!p.recognized && <span className="ml-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Web-researched</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-slate-700 font-medium">{p.userCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className={`text-sm font-bold ${cfg.badge.split(" ")[1]}`}>{p.riskScore}</span>
                            <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${p.riskScore}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="pr-3 text-slate-400">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${p.tool}-detail`} className="bg-slate-50">
                          <td colSpan={7} className="px-6 py-4">
                            <AppDetail profile={p} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {sortedApps.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No apps match the current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Users ── */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search by name, email, or department…"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 w-72"
            />
            <span className="text-xs text-slate-400">{filteredUsers.length} users with AI activity</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left hidden sm:table-cell">Department</th>
                  <th className="px-4 py-2.5 text-center">Tools</th>
                  <th className="px-4 py-2.5 text-left">Highest Risk</th>
                  <th className="px-4 py-2.5 text-left hidden md:table-cell">AI Tools in Use</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedUsers.map((u) => {
                  const cfg = RISK_CONFIG[u.highestRisk];
                  const isExpanded = expandedUser === u.userId;
                  return (
                    <>
                      <tr
                        key={u.userId}
                        onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${cfg.row}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 text-sm">{u.displayName ?? u.email}</div>
                          {u.displayName && <div className="text-xs text-slate-400">{u.email}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-600">{u.department ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-sm font-semibold text-slate-700">{u.tools.length}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {u.tools.slice(0, 4).map((t) => (
                              <span key={t.tool} className={`text-xs px-1.5 py-0.5 rounded ${RISK_CONFIG[t.riskLevel].badge}`}>{t.tool}</span>
                            ))}
                            {u.tools.length > 4 && (
                              <span className="text-xs text-slate-400">+{u.tools.length - 4} more</span>
                            )}
                          </div>
                        </td>
                        <td className="pr-3 text-slate-400">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${u.userId}-detail`} className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <UserDetail user={u} profileByTool={profileByTool} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">No users match the search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {userPageCount > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                Showing {userPage * PAGE_SIZE + 1}–{Math.min((userPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={userPage === 0}
                  onClick={() => setUserPage((p) => p - 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  disabled={userPage >= userPageCount - 1}
                  onClick={() => setUserPage((p) => p + 1)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Th({
  label, col, sort, dir, onSort, className,
}: {
  label: string;
  col: SortCol | null;
  sort: SortCol;
  dir: "asc" | "desc";
  onSort: (c: SortCol) => void;
  className?: string;
}) {
  const active = col && sort === col;
  if (!col) {
    return <th className={className ?? "px-4 py-2.5 text-left text-xs text-slate-500 font-medium"}>{label}</th>;
  }
  return (
    <th
      className={`px-4 py-2.5 text-xs font-medium cursor-pointer select-none transition-colors hover:text-slate-700 ${active ? "text-brand-700" : "text-slate-500"} ${className ?? "text-left"}`}
      onClick={() => onSort(col)}
    >
      {label}
      {active && <span className="ml-0.5 opacity-70">{dir === "desc" ? " ↓" : " ↑"}</span>}
    </th>
  );
}

function AppDetail({ profile }: { profile: AIToolProfile }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
      <div>
        <p className="font-semibold text-slate-600 mb-1">Description</p>
        <p className="text-slate-700">{profile.description}</p>
        {profile.webResearchSummary && (
          <p className="text-slate-500 mt-1 italic">{profile.webResearchSummary}</p>
        )}
      </div>
      {profile.aiCapabilities.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">AI Capabilities</p>
          <ul className="space-y-0.5">
            {profile.aiCapabilities.map((c, i) => (
              <li key={i} className="flex gap-1.5 text-slate-700"><span className="text-brand-500 shrink-0">▸</span>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {profile.riskFactors.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Risk Factors</p>
          <ul className="space-y-0.5">
            {profile.riskFactors.map((f, i) => (
              <li key={i} className="flex gap-1.5 text-slate-700"><span className="text-orange-400 shrink-0">⚠</span>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {profile.dataAccess.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Data / Systems Access</p>
          <div className="flex flex-wrap gap-1">
            {profile.dataAccess.map((s, i) => (
              <span key={i} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}
      {profile.userEmails.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Users ({profile.userCount})</p>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {profile.userEmails.map((email, i) => (
              <p key={i} className="text-slate-500 truncate">{email}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetail({ user, profileByTool }: {
  user: UserActivity & { tools: (UserActivity["aiToolsDetected"][0] & { riskLevel: AIRiskLevel; riskScore: number })[] };
  profileByTool: Map<string, AIToolProfile>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600">AI Tools Used by {user.displayName ?? user.email}</p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-200">
            <th className="pb-1.5 text-left font-medium">Tool</th>
            <th className="pb-1.5 text-left font-medium">Risk</th>
            <th className="pb-1.5 text-left font-medium hidden sm:table-cell">Category</th>
            <th className="pb-1.5 text-left font-medium hidden sm:table-cell">Detection</th>
            <th className="pb-1.5 text-right font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {user.tools
            .sort((a, b) => RISK_ORDER[b.riskLevel] - RISK_ORDER[a.riskLevel])
            .map((t) => {
              const cfg     = RISK_CONFIG[t.riskLevel];
              const profile = profileByTool.get(t.tool.toLowerCase());
              return (
                <tr key={t.tool}>
                  <td className="py-1.5 font-medium text-slate-700">{t.tool}</td>
                  <td className="py-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${cfg.badge}`}>{cfg.label}</span>
                  </td>
                  <td className="py-1.5 text-slate-500 hidden sm:table-cell">{profile?.category ?? "—"}</td>
                  <td className="py-1.5 text-slate-400 hidden sm:table-cell capitalize">{t.detectionMethod}</td>
                  <td className="py-1.5 text-right font-bold text-slate-600">{t.riskScore || "—"}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
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

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis as BXAxis, YAxis as BYAxis,
  Legend,
} from "recharts";
import type { BasicAIReport, AIRiskLevel } from "@/lib/types";
import type { ReportSummary } from "@/electron/db";
import {
  listScanSummaries,
  getScanReport,
  clearScanHistory,
  type StoredReportSummary,
} from "@/lib/scan-history";

// ─── Palette ──────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<AIRiskLevel, string> = {
  CRITICAL: "#F43F5E",
  HIGH:     "#F97316",
  MEDIUM:   "#FBBF24",
  LOW:      "#34D399",
};

const CATEGORY_COLORS = [
  "#2A8EC5", "#2EB598", "#7C3AED", "#EC4899",
  "#F59E0B", "#10B981", "#6366F1", "#EF4444",
  "#14B8A6", "#8B5CF6",
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MetricsPanelProps {
  /** Pass the just-run scan report when calling from the dashboard */
  currentReport?: BasicAIReport | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const eAPI = typeof window !== "undefined" ? window.electronAPI : undefined;

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  });
}

function fmtFull(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPI({ label, value, sub, color = "text-slate-800" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children, empty }: {
  title: string; children: React.ReactNode; empty?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">{title}</p>
      {empty ? (
        <div className="flex items-center justify-center h-40 text-xs text-slate-400">
          Not enough data — run more scans to see trends.
        </div>
      ) : children}
    </div>
  );
}

// Custom tooltip shared by line charts
function LineTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MetricsPanel({ currentReport }: MetricsPanelProps) {
  const [summaries, setSummaries]         = useState<(ReportSummary | StoredReportSummary)[]>([]);
  const [latestFull, setLatestFull]       = useState<BasicAIReport | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [detailReport, setDetailReport]   = useState<BasicAIReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const report = currentReport ?? detailReport ?? latestFull;

  // ── Load history ─────────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setLoading(true);
    if (eAPI) {
      const list = await eAPI.reports.list();
      setSummaries(list);
      if (list.length > 0 && !currentReport) {
        const full = await eAPI.reports.get(list[0].id);
        setLatestFull(full);
      }
    } else {
      const list = listScanSummaries();
      setSummaries(list);
      if (list.length > 0 && !currentReport) {
        const full = getScanReport(list[0].id);
        setLatestFull(full);
      }
    }
    setLoading(false);
  }, [currentReport]);

  useEffect(() => {
    void loadHistory();
    if (eAPI) {
      eAPI.on("scan:complete", () => void loadHistory());
      return () => eAPI.off("scan:complete", () => void loadHistory());
    } else {
      const onSaved = () => void loadHistory();
      window.addEventListener("ss:scan-saved", onSaved);
      return () => window.removeEventListener("ss:scan-saved", onSaved);
    }
  }, [loadHistory]);

  // ── Load drill-down report ────────────────────────────────────────────────────

  async function selectScan(id: string) {
    if (selectedScanId === id) { setSelectedScanId(null); setDetailReport(null); return; }
    setSelectedScanId(id);
    setLoadingDetail(true);
    let full: BasicAIReport | null = null;
    if (eAPI) {
      full = await eAPI.reports.get(id) ?? null;
    } else {
      full = getScanReport(id);
    }
    setDetailReport(full);
    setLoadingDetail(false);
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  // Timeline — chronological (oldest first)
  const timeline = [...summaries].reverse();

  // Category breakdown from the active full report
  const categoryData = report
    ? Object.entries(
        report.toolProfiles.reduce<Record<string, number>>((acc, t) => {
          acc[t.category] = (acc[t.category] ?? 0) + 1;
          return acc;
        }, {})
      )
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  // Risk breakdown
  const riskData: { name: string; count: number; color: string }[] = report
    ? [
        { name: "Critical", count: report.criticalTools,   color: RISK_COLOR.CRITICAL },
        { name: "High",     count: report.highRiskTools,   color: RISK_COLOR.HIGH },
        {
          name: "Medium",
          count: report.toolProfiles.filter((t) => t.riskLevel === "MEDIUM").length,
          color: RISK_COLOR.MEDIUM,
        },
        {
          name: "Low",
          count: report.toolProfiles.filter((t) => t.riskLevel === "LOW").length,
          color: RISK_COLOR.LOW,
        },
      ].filter((d) => d.count > 0)
    : [];

  // Top tools by user count
  const topTools = report
    ? [...report.toolProfiles].sort((a, b) => b.userCount - a.userCount).slice(0, 8)
    : [];

  // New tools vs previous scan
  const newTools: string[] = (() => {
    if (!currentReport || summaries.length < 1) return [];
    const prevNames = new Set<string>();
    return report?.toolProfiles
      .filter((t) => !prevNames.has(t.tool))
      .map((t) => t.tool) ?? [];
  })();

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-5">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to Dashboard
        </Link>
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          Loading metrics…
        </div>
      </div>
    );
  }

  const hasReport = !!report;
  const hasTimeline = timeline.length >= 2;

  if (!hasReport && summaries.length === 0) {
    return (
      <div className="space-y-5">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
          ← Back to Dashboard
        </Link>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm font-semibold text-slate-700 mb-1">No scan data yet</p>
          <p className="text-xs text-slate-400 max-w-sm">
            Run an AI Discovery scan to see metrics. Historical trends appear after two or more scans.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2">
            ← Back to Dashboard
          </Link>
          <h2 className="text-lg font-semibold text-slate-800">AI Risk Metrics</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {summaries.length > 0
              ? `${summaries.length} scan${summaries.length !== 1 ? "s" : ""} · latest ${fmtFull(summaries[0].generatedAt)}`
              : currentReport
              ? `Current session · ${fmtFull(currentReport.generatedAt)}`
              : ""}
          </p>
        </div>
        {eAPI && (
          <button
            onClick={() => void loadHistory()}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {/* KPI strip */}
      {hasReport && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI label="AI Tools Found"   value={report!.totalAIToolsFound} />
          <KPI label="Critical Risk"    value={report!.criticalTools}   color="text-rose-600" />
          <KPI label="High Risk"        value={report!.highRiskTools}   color="text-orange-500" />
          <KPI label="Users Scanned"    value={report!.totalUsersScanned} color="text-brand-600" />
        </div>
      )}

      {/* History KPIs (Electron only) */}
      {summaries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KPI label="Total Scans"      value={summaries.length} />
          <KPI label="Peak Tools Found" value={Math.max(...summaries.map((s) => s.totalTools))} />
          <KPI label="Peak Critical"    value={Math.max(...summaries.map((s) => s.criticalTools))} color="text-rose-600" />
          <KPI
            label="First Scan"
            value={fmt(summaries[summaries.length - 1].generatedAt)}
            sub={summaries.length > 1 ? `${summaries.length - 1} scans ago` : undefined}
          />
        </div>
      )}

      {/* Timeline charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="AI Tools Discovered Over Time" empty={!hasTimeline}>
          {hasTimeline && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="generatedAt" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<LineTooltip />} labelFormatter={(l: unknown) => fmt(String(l))} />
                <Line
                  type="monotone" dataKey="totalTools" name="Total tools"
                  stroke="#2A8EC5" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Risk Trend Over Time" empty={!hasTimeline}>
          {hasTimeline && (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeline} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="generatedAt" tickFormatter={fmt} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<LineTooltip />} labelFormatter={(l: unknown) => fmt(String(l))} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="criticalTools" name="Critical" stroke={RISK_COLOR.CRITICAL} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="highRiskTools"  name="High"     stroke={RISK_COLOR.HIGH}     strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Category + risk breakdown */}
      {hasReport && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Category donut */}
          <ChartCard title="Tools by Category">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={categoryData} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                    strokeWidth={2}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5 min-w-0">
                {categoryData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    <span className="text-xs text-slate-600 truncate flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-700 shrink-0">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>

          {/* Risk donut */}
          <ChartCard title="Risk Distribution">
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie
                    data={riskData} dataKey="count" nameKey="name"
                    cx="50%" cy="50%" innerRadius={44} outerRadius={72}
                    strokeWidth={2}
                  >
                    {riskData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5 min-w-0">
                {riskData.map((d) => {
                  const pct = report!.totalAIToolsFound
                    ? Math.round((d.count / report!.totalAIToolsFound) * 100)
                    : 0;
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-600">{d.name}</span>
                        <span className="text-xs font-semibold text-slate-700">{d.count}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: d.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ChartCard>
        </div>
      )}

      {/* Top tools by user count */}
      {topTools.length > 0 && (
        <ChartCard title="Top Tools by User Adoption">
          <ResponsiveContainer width="100%" height={topTools.length * 36 + 16}>
            <BarChart
              layout="vertical"
              data={topTools.map((t) => ({
                name: t.tool,
                users: t.userCount,
                fill: RISK_COLOR[t.riskLevel],
              }))}
              margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
              <BYAxis
                type="category" dataKey="name" width={120}
                tick={{ fontSize: 11 }} tickLine={false}
              />
              <BXAxis type="number" tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v) => [v, "Users"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="users" radius={[0, 4, 4, 0]}>
                {topTools.map((t, i) => (
                  <Cell key={i} fill={RISK_COLOR[t.riskLevel]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as AIRiskLevel[]).map((lvl) => (
              <div key={lvl} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: RISK_COLOR[lvl] }} />
                <span className="text-xs text-slate-500">{lvl[0] + lvl.slice(1).toLowerCase()}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {/* Per-tool risk score scatter (table form) */}
      {hasReport && report!.toolProfiles.length > 0 && (
        <ChartCard title="All Tools — Risk Scores">
          <div className="space-y-2">
            {[...report!.toolProfiles]
              .sort((a, b) => b.riskScore - a.riskScore)
              .map((t) => (
                <div key={t.tool} className="flex items-center gap-3">
                  <div className="w-32 shrink-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{t.tool}</p>
                    <p className="text-xs text-slate-400 truncate">{t.category}</p>
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${t.riskScore}%`,
                        background: RISK_COLOR[t.riskLevel],
                      }}
                    />
                  </div>
                  <span
                    className="text-xs font-bold w-6 text-right shrink-0"
                    style={{ color: RISK_COLOR[t.riskLevel] }}
                  >
                    {t.riskScore}
                  </span>
                  <span className="text-xs text-slate-400 w-14 text-right shrink-0">
                    {t.userCount} user{t.userCount !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
          </div>
        </ChartCard>
      )}

      {/* Scan history list (Electron) */}
      {summaries.length > 0 && (
        <ChartCard title="Scan History">
          <div className="space-y-2">
            {summaries.map((s) => (
              <div key={s.id}>
                <button
                  onClick={() => void selectScan(s.id)}
                  className="w-full flex items-center gap-3 text-left hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700">{fmtFull(s.generatedAt)}</p>
                    <p className="text-xs text-slate-400">{s.totalUsers} users · {s.totalTools} tools</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.criticalTools > 0 && (
                      <span className="text-xs bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full">
                        {s.criticalTools} critical
                      </span>
                    )}
                    {s.highRiskTools > 0 && (
                      <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full">
                        {s.highRiskTools} high
                      </span>
                    )}
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${selectedScanId === s.id ? "rotate-90" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {selectedScanId === s.id && (
                  <div className="ml-3 mt-1 mb-2 pl-3 border-l-2 border-slate-100">
                    {loadingDetail ? (
                      <p className="text-xs text-slate-400 py-2">Loading…</p>
                    ) : detailReport ? (
                      <div className="space-y-1.5 py-1">
                        {detailReport.toolProfiles.slice(0, 12).map((t) => (
                          <div key={t.tool} className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: RISK_COLOR[t.riskLevel] }}
                            />
                            <span className="text-xs text-slate-600 truncate flex-1">{t.tool}</span>
                            <span className="text-xs text-slate-400 shrink-0">{t.userCount} user{t.userCount !== 1 ? "s" : ""}</span>
                            <span className="text-xs font-semibold shrink-0" style={{ color: RISK_COLOR[t.riskLevel] }}>{t.riskScore}</span>
                          </div>
                        ))}
                        {detailReport.toolProfiles.length > 12 && (
                          <p className="text-xs text-slate-400">+{detailReport.toolProfiles.length - 12} more</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

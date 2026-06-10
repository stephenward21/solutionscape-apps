"use client";

import * as React from "react";
import type { DrataMonitoringTest, TestsAISummaryResult, TestPriorityItem } from "@/lib/types";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  PASSED:   { label: "Passing",  badge: "bg-green-100 text-green-700",  dot: "bg-green-500" },
  FAILED:   { label: "Failing",  badge: "bg-red-100 text-red-700",      dot: "bg-red-500" },
  ERROR:    { label: "Error",    badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500" },
  PREAUDIT: { label: "Pre-audit",badge: "bg-slate-100 text-slate-500",  dot: "bg-slate-300" },
  READY:    { label: "Ready",    badge: "bg-blue-100 text-blue-600",    dot: "bg-blue-400" },
  NA:       { label: "N/A",      badge: "bg-slate-100 text-slate-400",  dot: "bg-slate-200" },
};

const PRIORITY_CONFIG: Record<TestPriorityItem["priority"], { badge: string; bar: string }> = {
  CRITICAL: { badge: "bg-red-100 text-red-700",     bar: "bg-red-500" },
  HIGH:     { badge: "bg-orange-100 text-orange-700", bar: "bg-orange-400" },
  MEDIUM:   { badge: "bg-amber-100 text-amber-700",  bar: "bg-amber-400" },
  LOW:      { badge: "bg-slate-100 text-slate-500",  bar: "bg-slate-300" },
};

function statusCfg(status: string | undefined) {
  return STATUS_CONFIG[status ?? ""] ?? { label: status ?? "Unknown", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-300" };
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Types for API response ───────────────────────────────────────────────────

interface TestCounts {
  total: number;
  passing: number;
  failing: number;
  error: number;
  preaudit: number;
  disabled: number;
  enabled: number;
  passRate: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  workspaceId: number;
}

type StatusFilter = "all" | "FAILED" | "ERROR" | "PASSED" | "PREAUDIT";

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function MonitoringTestsPanel({ workspaceId }: Props) {
  const [tests, setTests]           = React.useState<DrataMonitoringTest[]>([]);
  const [counts, setCounts]         = React.useState<TestCounts | null>(null);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState<string | null>(null);

  const [aiResult, setAiResult]     = React.useState<TestsAISummaryResult | null>(null);
  const [aiLoading, setAiLoading]   = React.useState(true);
  const [aiError, setAiError]       = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [search, setSearch]         = React.useState("");
  const [expanded, setExpanded]     = React.useState<Set<number>>(new Set());
  const [aiExpanded, setAiExpanded] = React.useState<Set<string>>(new Set());

  // Load tests
  React.useEffect(() => {
    fetch(`/api/client/${workspaceId}/monitoring-tests`)
      .then((r) => r.json())
      .then((d: { tests: DrataMonitoringTest[]; counts: TestCounts; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setTests(d.tests ?? []);
        setCounts(d.counts ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // Load AI priorities
  React.useEffect(() => {
    fetch(`/api/client/${workspaceId}/monitoring-tests/ai`)
      .then((r) => r.json())
      .then((d: TestsAISummaryResult & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setAiResult(d);
      })
      .catch((e: unknown) => setAiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setAiLoading(false));
  }, [workspaceId]);

  function refreshAI(force = false) {
    setAiLoading(true);
    setAiError(null);
    const url = `/api/client/${workspaceId}/monitoring-tests/ai${force ? "?refresh=true" : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: TestsAISummaryResult & { error?: string }) => {
        if (d.error) throw new Error(d.error);
        setAiResult(d);
      })
      .catch((e: unknown) => setAiError(e instanceof Error ? e.message : String(e)))
      .finally(() => setAiLoading(false));
  }

  function toggleTest(id: number) {
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAI(id: string) {
    setAiExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Filtered test list
  const filtered = tests.filter((t) => {
    const statusMatch = statusFilter === "all" || t.checkResultStatus === statusFilter;
    const searchLow = search.toLowerCase();
    const searchMatch =
      !search ||
      (t.name ?? "").toLowerCase().includes(searchLow) ||
      (t.sourceName ?? "").toLowerCase().includes(searchLow) ||
      (t.source ?? "").toLowerCase().includes(searchLow) ||
      (t.controls ?? []).some(
        (c) => c.code.toLowerCase().includes(searchLow) || c.name.toLowerCase().includes(searchLow)
      );
    return statusMatch && searchMatch;
  });

  if (loading) return <LoadingSpinner />;
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
        Failed to load monitoring tests: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Total Tests"  value={counts.total}   color="text-slate-700"  bg="bg-slate-50" />
          <StatBox label="Passing"      value={counts.passing} color="text-green-600"  bg="bg-green-50" />
          <StatBox label="Failing"      value={counts.failing} color="text-red-600"    bg="bg-red-50" />
          <StatBox label="Error"        value={counts.error}   color="text-orange-600" bg="bg-orange-50" />
        </div>
      )}

      {/* Pass rate bar */}
      {counts && counts.enabled > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Pass Rate (enabled tests)
            </span>
            <span className="text-sm font-bold text-slate-800">{counts.passRate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                counts.passRate >= 90 ? "bg-green-500" :
                counts.passRate >= 70 ? "bg-amber-400" : "bg-red-500"
              }`}
              style={{ width: `${counts.passRate}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>{counts.passing} passing</span>
            <span>{counts.failing + counts.error} failing/error</span>
            {counts.disabled > 0 && <span>{counts.disabled} disabled</span>}
          </div>
        </div>
      )}

      {/* AI Priorities */}
      <AIPrioritiesSection
        result={aiResult}
        loading={aiLoading}
        error={aiError}
        expanded={aiExpanded}
        onToggle={toggleAI}
        onRefresh={() => refreshAI(true)}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {(["all", "FAILED", "ERROR", "PASSED", "PREAUDIT"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                statusFilter === f
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? "All" : statusCfg(f).label}
              {f !== "all" && (
                <span className="ml-1 opacity-60">
                  ({tests.filter((t) => t.checkResultStatus === f).length})
                </span>
              )}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search name, service, control…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-40"
        />
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} shown</span>
      </div>

      {/* Test list */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">No tests match the current filter.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((test) => (
            <TestRow
              key={test.id}
              test={test}
              expanded={expanded.has(test.id)}
              onToggle={() => toggleTest(test.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Priorities section ────────────────────────────────────────────────────

function AIPrioritiesSection({
  result,
  loading,
  error,
  expanded,
  onToggle,
  onRefresh,
}: {
  result: TestsAISummaryResult | null;
  loading: boolean;
  error: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
          ✨ AI Test Priorities
        </span>
        {!loading && (
          <button
            onClick={onRefresh}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium bg-white/70 hover:bg-white px-2.5 py-1 rounded-lg transition-colors"
          >
            ↺ Refresh
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-3">
          <svg className="animate-spin w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs text-violet-600">Claude is analyzing test failures…</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {result.overallHealthSummary && (
            <p className="text-xs text-slate-700 leading-relaxed bg-white/60 rounded-lg px-3 py-2.5">
              {result.overallHealthSummary}
            </p>
          )}

          {result.priorityItems.length === 0 ? (
            <p className="text-xs text-green-700 font-medium">
              ✓ No failing tests — all monitored checks are passing.
            </p>
          ) : (
            <div className="space-y-2">
              {result.priorityItems.map((item) => {
                const cfg = PRIORITY_CONFIG[item.priority];
                const isOpen = expanded.has(item.id);
                return (
                  <div key={item.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <button
                      onClick={() => onToggle(item.id)}
                      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${cfg.badge}`}>
                        {item.priority}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{item.testName}</p>
                        {item.controlsAffected.length > 0 && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {item.controlsAffected.length} control{item.controlsAffected.length !== 1 ? "s" : ""}
                            {item.failingSince && ` · failing since ${relativeTime(item.failingSince)}`}
                          </p>
                        )}
                        {!isOpen && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{item.reasoning}</p>
                        )}
                      </div>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-3 py-3 space-y-2">
                        <p className="text-xs text-slate-600 leading-relaxed">{item.reasoning}</p>
                        {item.estimatedImpact && (
                          <p className="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1.5">
                            <span className="font-semibold">Impact: </span>{item.estimatedImpact}
                          </p>
                        )}
                        {item.suggestedAction && (
                          <div className="bg-green-50 rounded px-2 py-1.5">
                            <span className="text-xs font-semibold text-green-700">Action: </span>
                            <span className="text-xs text-green-800">{item.suggestedAction}</span>
                          </div>
                        )}
                        {item.controlsAffected.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.controlsAffected.map((c) => (
                              <span key={c.code} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                {c.code}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {result.generatedAt && (
            <p className="text-xs text-slate-400 text-right">
              Generated {new Date(result.generatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Individual test row ──────────────────────────────────────────────────────

function TestRow({
  test,
  expanded,
  onToggle,
}: {
  test: DrataMonitoringTest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = statusCfg(test.checkResultStatus);
  const isFailing = test.checkResultStatus === "FAILED" || test.checkResultStatus === "ERROR";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            {isFailing && test.failingSince && (
              <span className="text-xs text-red-500">
                failing {relativeTime(test.failingSince)}
              </span>
            )}
            {(test.sourceName ?? test.source) && (
              <span className="text-xs text-slate-400">
                {test.sourceName ?? test.source}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">
            {test.name ?? `Test #${test.id}`}
          </p>
          <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-slate-400">
            {(test.controls ?? []).length > 0 && (
              <span>{test.controls!.length} control{test.controls!.length !== 1 ? "s" : ""}</span>
            )}
            {test.lastCheckedAt && (
              <span>Checked {relativeTime(test.lastCheckedAt)}</span>
            )}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {test.description && (
            <p className="text-xs text-slate-600 leading-relaxed">{test.description}</p>
          )}

          {/* Controls */}
          {(test.controls ?? []).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1.5">Mapped Controls</p>
              <div className="flex flex-wrap gap-1.5">
                {test.controls!.map((c) => (
                  <span
                    key={c.id}
                    className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-mono"
                    title={c.name}
                  >
                    {c.code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Remediation */}
          {test.remediationInstructions && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">Remediation</p>
              <p className="text-xs text-amber-800 leading-relaxed">{test.remediationInstructions}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1 border-t border-slate-50">
            {test.checkStatus && <span>Status: {test.checkStatus}</span>}
            {test.frequency   && <span>Frequency: {test.frequency}</span>}
            {test.severity    && <span>Severity: {test.severity}</span>}
            {test.lastCheckedAt && (
              <span>Last checked: {new Date(test.lastCheckedAt).toLocaleString()}</span>
            )}
            {test.failingSince && (
              <span className="text-red-400">
                Failing since: {new Date(test.failingSince).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label, value, color, bg,
}: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

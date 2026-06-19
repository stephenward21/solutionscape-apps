"use client";

import * as React from "react";
import type { DrataMonitoringTest } from "@/lib/types";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  PASSED:   { label: "Passing",   badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  FAILED:   { label: "Failing",   badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
  ERROR:    { label: "Error",     badge: "bg-orange-100 text-orange-700",   dot: "bg-orange-500" },
  PREAUDIT: { label: "Pre-audit", badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
  READY:    { label: "Ready",     badge: "bg-blue-100 text-blue-600",       dot: "bg-blue-400" },
  NA:       { label: "N/A",       badge: "bg-slate-100 text-slate-400",     dot: "bg-slate-200" },
  INACTIVE: { label: "Inactive",  badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
  DISABLED: { label: "Disabled",  badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
  UNUSED:   { label: "Unused",    badge: "bg-slate-100 text-slate-400",     dot: "bg-slate-200" },
  NEW:      { label: "New",       badge: "bg-blue-50 text-blue-500",        dot: "bg-blue-300" },
  TESTING:  { label: "Testing",   badge: "bg-purple-50 text-purple-500",    dot: "bg-purple-300" },
};

const INACTIVE_CHECK_STATUSES = new Set(["DISABLED", "UNUSED", "NEW", "TESTING"]);

function effectiveStatus(test: DrataMonitoringTest) {
  if (test.checkStatus && INACTIVE_CHECK_STATUSES.has(test.checkStatus)) {
    const cfg = STATUS_CONFIG[test.checkStatus] ?? STATUS_CONFIG["INACTIVE"]!;
    return { key: "INACTIVE", ...cfg };
  }
  const key = test.checkResultStatus ?? "";
  return { key, ...(STATUS_CONFIG[key] ?? { label: key || "Unknown", badge: "bg-slate-100 text-slate-500", dot: "bg-slate-300" }) };
}

function relativeTime(dateStr: string | undefined): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCounts {
  total: number;
  inactive: number;
  enabled: number;
  passing: number;
  failing: number;
  error: number;
  preaudit: number;
  passRate: number;
}

type StatusFilter = "all" | "FAILED" | "ERROR" | "PASSED" | "INACTIVE";

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function MonitoringTestsPanel({ token }: Props) {
  const [tests, setTests]     = React.useState<DrataMonitoringTest[]>([]);
  const [counts, setCounts]   = React.useState<TestCounts | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError]     = React.useState<string | null>(null);

  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [search, setSearch]   = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    fetch(`/api/portal/${token}/monitoring-tests`)
      .then((r) => r.json())
      .then((d: { tests: DrataMonitoringTest[]; counts: TestCounts; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setTests(d.tests ?? []);
        setCounts(d.counts ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [token]);

  function toggle(id: number) {
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const filtered = tests.filter((t) => {
    const eff = effectiveStatus(t);
    const statusMatch = statusFilter === "all" || eff.key === statusFilter;
    const low = search.toLowerCase();
    const searchMatch =
      !search ||
      (t.name ?? "").toLowerCase().includes(low) ||
      (t.sourceName ?? "").toLowerCase().includes(low) ||
      (t.source ?? "").toLowerCase().includes(low) ||
      (t.controls ?? []).some(
        (c) => c.code.toLowerCase().includes(low) || c.name.toLowerCase().includes(low)
      );
    return statusMatch && searchMatch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
        Failed to load monitoring tests: {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Total Tests"     value={counts.total}                      color="text-slate-700"   bg="bg-slate-50" />
          <StatBox label="Passing"         value={counts.passing}                    color="text-emerald-600" bg="bg-emerald-50" />
          <StatBox label="Failing / Error" value={counts.failing + counts.error}     color="text-rose-600"    bg="bg-rose-50" />
          <StatBox label="Inactive"        value={counts.inactive}                   color="text-slate-500"   bg="bg-slate-100" />
        </div>
      )}

      {/* Pass rate bar */}
      {counts && counts.enabled > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Test Pass Rate (enabled)
            </span>
            <span className="text-sm font-bold text-slate-800">{counts.passRate}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                counts.passRate >= 90 ? "bg-emerald-500" :
                counts.passRate >= 70 ? "bg-amber-400" : "bg-rose-500"
              }`}
              style={{ width: `${counts.passRate}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-400">
            <span>{counts.passing} passing</span>
            <span>{counts.failing + counts.error} failing/error</span>
            {counts.inactive > 0 && <span>{counts.inactive} inactive</span>}
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {(["all", "FAILED", "ERROR", "PASSED", "INACTIVE"] as StatusFilter[]).map((f) => {
            const cfg = f !== "all" ? (STATUS_CONFIG[f] ?? STATUS_CONFIG["INACTIVE"]!) : null;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === f
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f === "all" ? "All" : cfg!.label}
                {f !== "all" && (
                  <span className="ml-1 opacity-60">
                    ({tests.filter((t) => effectiveStatus(t).key === f).length})
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search name, service, control…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-40"
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
              onToggle={() => toggle(test.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TestRow ──────────────────────────────────────────────────────────────────

function TestRow({
  test,
  expanded,
  onToggle,
}: {
  test: DrataMonitoringTest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = effectiveStatus(test);
  const isFailing = test.checkStatus === "ENABLED" &&
    (test.checkResultStatus === "FAILED" || test.checkResultStatus === "ERROR");

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            {isFailing && test.failingSince && (
              <span className="text-xs text-rose-500">
                failing {relativeTime(test.failingSince)}
              </span>
            )}
            {(test.sourceName ?? test.source) && (
              <span className="text-xs text-slate-400">{test.sourceName ?? test.source}</span>
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

          {test.remediationInstructions && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-amber-700 mb-1">Remediation</p>
              <p className="text-xs text-amber-800 leading-relaxed">{test.remediationInstructions}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1 border-t border-slate-50">
            {test.checkStatus && <span>Status: {test.checkStatus}</span>}
            {test.frequency   && <span>Frequency: {test.frequency}</span>}
            {test.severity    && <span>Severity: {test.severity}</span>}
            {test.lastCheckedAt && (
              <span>Last checked: {new Date(test.lastCheckedAt).toLocaleString()}</span>
            )}
            {test.failingSince && (
              <span className="text-rose-400">
                Failing since: {new Date(test.failingSince).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StatBox ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

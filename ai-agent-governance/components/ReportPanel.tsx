"use client";

import { useState } from "react";
import type { GovernanceReport, UserComplianceRecord, ComplianceStatus, PolicyAnalysisResult, UserActivity } from "@/lib/types";

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; badge: string; dot: string }> = {
  COMPLIANT:   { label: "Compliant",   badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  BREACH:      { label: "Breach",      badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
  CONDITIONAL: { label: "Conditional", badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  UNKNOWN:     { label: "Unknown",     badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
};

interface ReportPanelProps {
  policyResult: PolicyAnalysisResult | null;
  idpUsers: UserActivity[];
}

export default function ReportPanel({ policyResult, idpUsers }: ReportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GovernanceReport | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | "all">("all");

  async function generateReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyResult, users: idpUsers }),
      });
      const data = await res.json() as GovernanceReport & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Report generation failed");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const filtered = (report?.userRecords ?? []).filter((u) => {
    const statusMatch = statusFilter === "all" || u.complianceStatus === statusFilter;
    const low = search.toLowerCase();
    const searchMatch =
      !search ||
      u.email.toLowerCase().includes(low) ||
      (u.displayName ?? "").toLowerCase().includes(low) ||
      (u.department ?? "").toLowerCase().includes(low) ||
      u.breachingTools.some((t) => t.tool.toLowerCase().includes(low));
    return statusMatch && searchMatch;
  });

  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Compliance Report</h2>
          <p className="text-sm text-slate-500">
            After uploading a policy and connecting your directory, generate a report
            showing which users are breaching your AI policy and why.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm font-semibold text-slate-700 mb-1">Generate Compliance Report</p>

          {/* Step checklist */}
          <div className="inline-flex flex-col gap-2 text-left mb-5 mt-2">
            <StepCheck done={!!policyResult} label="AI Policy analyzed" />
            <StepCheck done={idpUsers.length > 0} label={`Directory connected${idpUsers.length > 0 ? ` (${idpUsers.length} users)` : ""}`} />
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 mb-4 text-left">
              {error}
            </div>
          )}

          <button
            onClick={() => { void generateReport(); }}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Claude is generating report…
              </>
            ) : (
              "Generate Compliance Report"
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Compliance Report</h2>
          {report.organizationName && (
            <p className="text-sm text-slate-500">{report.organizationName}</p>
          )}
          <p className="text-xs text-slate-400">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Print / PDF
          </button>
          <button
            onClick={() => { setReport(null); }}
            className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors"
          >
            Regenerate
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Total Users"   value={report.totalUsers}      color="text-slate-700"   bg="bg-slate-50" />
        <StatBox label="Compliant"     value={report.compliantUsers}  color="text-emerald-600" bg="bg-emerald-50" />
        <StatBox label="In Breach"     value={report.breachingUsers}  color="text-rose-600"    bg="bg-rose-50" />
        <StatBox label="Conditional"   value={report.conditionalUsers} color="text-amber-600"  bg="bg-amber-50" />
      </div>

      {/* Unrecognized apps flagged for manual review */}
      {report.toolsNeedingReview > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">
            {report.toolsNeedingReview} App{report.toolsNeedingReview === 1 ? "" : "s"} Need Manual Review
          </p>
          <p className="text-xs text-violet-700">
            These OAuth grants didn&apos;t match our known AI-tool list and Claude couldn&apos;t confidently
            classify them as AI or non-AI. Expand a user below to see details — this is how new/unlisted
            tools (e.g. a tool not yet in our signatures) get surfaced instead of silently dropped.
          </p>
        </div>
      )}

      {/* Prohibited tools in active use */}
      {report.prohibitedToolsInUse.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
            Prohibited Tools Actively In Use
          </p>
          <div className="flex flex-wrap gap-2">
            {report.prohibitedToolsInUse.map((tool) => (
              <span key={tool} className="text-xs bg-white border border-rose-300 text-rose-700 px-2 py-1 rounded-full font-medium">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI narrative */}
      {report.aiNarrative && (
        <div className="bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">AI Executive Summary</p>
          <p className="text-sm text-slate-700 leading-relaxed">{report.aiNarrative}</p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          {(["all", "BREACH", "CONDITIONAL", "COMPLIANT", "UNKNOWN"] as const).map((f) => {
            const cfg = f !== "all" ? STATUS_CONFIG[f] : null;
            const count = f === "all"
              ? report.userRecords.length
              : report.userRecords.filter((u) => u.complianceStatus === f).length;
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
                <span className="ml-1 opacity-60">({count})</span>
              </button>
            );
          })}
        </div>
        <input
          type="text"
          placeholder="Search user, tool, department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-48"
        />
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} shown</span>
      </div>

      {/* User records */}
      <div className="space-y-2">
        {filtered.map((u) => (
          <UserRecord key={u.userId} user={u} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">No users match the current filter.</div>
        )}
      </div>
    </div>
  );
}

function UserRecord({ user }: { user: UserComplianceRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[user.complianceStatus];

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {user.displayName ?? user.email}
            </span>
            {user.department && (
              <span className="text-xs text-slate-400">{user.department}</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
          {user.breachingTools.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {user.breachingTools.map((t, i) => (
                <span key={i} className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded">
                  {t.tool}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <span className={`text-sm font-bold ${
            user.riskScore >= 70 ? "text-rose-600" :
            user.riskScore >= 40 ? "text-amber-600" : "text-emerald-600"
          }`}>
            {user.riskScore}
          </span>
          <p className="text-xs text-slate-400">risk</p>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {user.breachingTools.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-rose-700 mb-2">Policy Breaches</p>
              {user.breachingTools.map((t, i) => (
                <div key={i} className="bg-rose-50 border border-rose-100 rounded-lg p-3 mb-2">
                  <p className="text-sm font-semibold text-slate-800">{t.tool}
                    <span className="text-xs font-normal text-slate-400 ml-2">{t.vendor}</span>
                  </p>
                  <p className="text-xs text-rose-700 mt-0.5">{t.reason}</p>
                  {t.systemsAccessed && t.systemsAccessed.length > 0 && (
                    <p className="text-xs text-slate-500 mt-1">
                      Systems accessed: {t.systemsAccessed.join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 bg-white rounded px-2 py-1 mt-2 border border-rose-100">
                    <span className="font-semibold">Recommendation: </span>{t.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {user.conditionalTools.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-2">Conditional Tools (review required)</p>
              {user.conditionalTools.map((t, i) => (
                <div key={i} className="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-2">
                  <p className="text-sm font-semibold text-slate-800">{t.tool}</p>
                  <p className="text-xs text-amber-700 mt-0.5">{t.reason}</p>
                </div>
              ))}
            </div>
          )}

          {user.approvedTools.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-emerald-700 mb-1">Approved Tools In Use</p>
              <div className="flex flex-wrap gap-1">
                {user.approvedTools.map((t, i) => (
                  <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {t.tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {user.needsReview && user.needsReview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-violet-700 mb-2">Needs Manual Review</p>
              {user.needsReview.map((t, i) => (
                <div key={i} className="bg-violet-50 border border-violet-100 rounded-lg p-3 mb-2">
                  <p className="text-sm font-semibold text-slate-800">{t.tool}</p>
                  <p className="text-xs text-violet-700 mt-0.5">{t.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
      )}
      <span className={`text-xs ${done ? "text-slate-700 font-medium" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

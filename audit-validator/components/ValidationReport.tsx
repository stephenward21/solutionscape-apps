"use client";

import { useState } from "react";
import type { ValidationReport, FileValidationResult, Adequacy } from "@/lib/types";

const STATUS_CONFIG = {
  AUDIT_READY: { label: "Audit Ready", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "✅" },
  NEEDS_WORK: { label: "Needs Work", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: "⚠️" },
  NOT_READY: { label: "Not Audit Ready", color: "text-rose-700", bg: "bg-rose-50 border-rose-200", icon: "❌" },
};

const ADEQUACY_CONFIG: Record<Adequacy, { label: string; color: string; badge: string }> = {
  ADEQUATE: { label: "Adequate", color: "text-emerald-700", badge: "bg-emerald-100 text-emerald-700" },
  PARTIAL: { label: "Partial", color: "text-amber-700", badge: "bg-amber-100 text-amber-700" },
  INADEQUATE: { label: "Inadequate", color: "text-rose-700", badge: "bg-rose-100 text-rose-700" },
  UNRELATED: { label: "Unrelated", color: "text-slate-500", badge: "bg-slate-100 text-slate-500" },
};

type ResultTab = "summary" | "files" | "gaps";

export default function ValidationReport({
  report,
  onReset,
}: {
  report: ValidationReport;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<ResultTab>("summary");
  const status = STATUS_CONFIG[report.overallStatus];

  const coveragePercent =
    report.totalInScopeControls > 0
      ? Math.round((report.coveredControlCount / report.totalInScopeControls) * 100)
      : 0;

  const adequateCount = report.controlGaps.filter((g) => g.bestAdequacy === "ADEQUATE").length;
  const adequacyPercent =
    report.coveredControlCount > 0
      ? Math.round((adequateCount / report.coveredControlCount) * 100)
      : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Status header */}
      <div className={`border rounded-2xl p-6 mb-6 ${status.bg}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-3xl mb-2">{status.icon}</div>
            <h2 className={`text-xl font-bold ${status.color}`}>{status.label}</h2>
            <p className="text-sm text-slate-600 mt-1">{report.workspaceName}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Generated {new Date(report.createdAt).toLocaleString()} · Report ID: {report.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex gap-6">
            <Metric label="Evidence Coverage" value={`${coveragePercent}%`}
              sub={`${report.coveredControlCount}/${report.totalInScopeControls} controls`}
              color={coveragePercent >= 80 ? "text-emerald-700" : coveragePercent >= 50 ? "text-amber-700" : "text-rose-700"} />
            <Metric label="Evidence Adequacy" value={`${adequacyPercent}%`}
              sub={`${adequateCount}/${report.coveredControlCount} adequate`}
              color={adequacyPercent >= 80 ? "text-emerald-700" : adequacyPercent >= 50 ? "text-amber-700" : "text-rose-700"} />
            <Metric label="Files Reviewed" value={String(report.fileResults.length)}
              sub="evidence files" color="text-slate-700" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="border-b border-slate-100 px-6 flex gap-1">
          {(["summary", "files", "gaps"] as ResultTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3.5 text-sm font-medium border-b-2 capitalize transition-colors ${
                tab === t
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "summary" ? "Executive Summary" : t === "files" ? "File Results" : "Control Gaps"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "summary" && <SummaryTab report={report} />}
          {tab === "files" && <FilesTab fileResults={report.fileResults} />}
          {tab === "gaps" && <GapsTab report={report} />}
        </div>
      </div>

      <div className="flex justify-between mt-4">
        <button
          onClick={onReset}
          className="text-slate-500 hover:text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          ← New Validation
        </button>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-report-${report.id.slice(0, 8)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          ↓ Download Report
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

function SummaryTab({ report }: { report: ValidationReport }) {
  const gapsByAdequacy = {
    INADEQUATE: report.controlGaps.filter((g) => g.bestAdequacy === "INADEQUATE"),
    PARTIAL: report.controlGaps.filter((g) => g.bestAdequacy === "PARTIAL"),
    UNRELATED: report.controlGaps.filter((g) => g.bestAdequacy === "UNRELATED"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">AI Assessment</h3>
        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100">
          {report.executiveSummary}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { adequacy: "INADEQUATE" as Adequacy, items: gapsByAdequacy.INADEQUATE, label: "Inadequate Evidence" },
          { adequacy: "PARTIAL" as Adequacy, items: gapsByAdequacy.PARTIAL, label: "Partial Evidence" },
          { adequacy: "UNRELATED" as Adequacy, items: gapsByAdequacy.UNRELATED, label: "Unrelated Evidence" },
        ].map(({ adequacy, items, label }) => {
          if (items.length === 0) return null;
          const cfg = ADEQUACY_CONFIG[adequacy];
          return (
            <div key={adequacy} className={`rounded-xl border p-4 ${cfg.badge.includes("rose") ? "bg-rose-50 border-rose-100" : cfg.badge.includes("amber") ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"}`}>
              <div className={`text-lg font-bold ${cfg.color}`}>{items.length}</div>
              <div className="text-xs font-medium text-slate-600">{label}</div>
              <div className="mt-2 space-y-1">
                {items.slice(0, 3).map((g) => (
                  <p key={g.controlId} className="text-xs text-slate-500 truncate">• {g.controlCode} {g.controlName}</p>
                ))}
                {items.length > 3 && <p className="text-xs text-slate-400">+{items.length - 3} more</p>}
              </div>
            </div>
          );
        })}
      </div>

      {report.uncoveredControlCount > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">
            ⚠ {report.uncoveredControlCount} controls have no evidence mapped
          </p>
          <p className="text-xs text-slate-500">
            These controls are in-scope but had no evidence files assigned to them during this validation.
            Consider uploading additional evidence for these controls.
          </p>
        </div>
      )}
    </div>
  );
}

function FilesTab({ fileResults }: { fileResults: FileValidationResult[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {fileResults.map((fr) => {
        const open = expanded.has(fr.fileId);
        const adequacyCounts = fr.controlValidations.reduce(
          (acc, cv) => { acc[cv.adequacy] = (acc[cv.adequacy] ?? 0) + 1; return acc; },
          {} as Record<Adequacy, number>
        );

        return (
          <div key={fr.fileId} className="border border-slate-100 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(fr.fileId)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
            >
              <span className="text-xl mt-0.5">📁</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{fr.fileName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{fr.fileDescription}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(Object.entries(adequacyCounts) as [Adequacy, number][]).map(([a, count]) => (
                    <span key={a} className={`text-xs px-2 py-0.5 rounded-full font-medium ${ADEQUACY_CONFIG[a].badge}`}>
                      {count} {ADEQUACY_CONFIG[a].label}
                    </span>
                  ))}
                </div>
              </div>
              <svg className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {open && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {fr.controlValidations.map((cv) => {
                  const cfg = ADEQUACY_CONFIG[cv.adequacy];
                  return (
                    <div key={cv.controlId} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{cv.controlCode}</span>
                        {cv.frameworkTags.map((t) => (
                          <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                        <span className="text-xs text-slate-400">confidence: {cv.confidence}</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700">{cv.controlName}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cv.finding}</p>
                      {cv.gaps.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-rose-600 mb-1">Gaps:</p>
                          <ul className="list-disc list-inside space-y-0.5">
                            {cv.gaps.map((g, i) => (
                              <li key={i} className="text-xs text-slate-500">{g}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {cv.recommendation && (
                        <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-slate-500">Recommended: </span>
                          <span className="text-xs text-slate-600">{cv.recommendation}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GapsTab({ report }: { report: ValidationReport }) {
  const order: Adequacy[] = ["INADEQUATE", "PARTIAL", "UNRELATED", "ADEQUATE"];
  const sorted = [...report.controlGaps].sort(
    (a, b) => order.indexOf(a.bestAdequacy) - order.indexOf(b.bestAdequacy)
  );

  return (
    <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
      {sorted.map((g) => {
        const cfg = ADEQUACY_CONFIG[g.bestAdequacy];
        return (
          <div key={g.controlId} className="border border-slate-100 rounded-xl p-3.5">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {cfg.label}
              </span>
              <span className="text-xs font-mono text-slate-400">{g.controlCode}</span>
              {g.frameworkTags.map((t) => (
                <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  {t}
                </span>
              ))}
              <span className="text-xs text-slate-400 ml-auto">
                {g.mappedFileCount} file{g.mappedFileCount !== 1 ? "s" : ""} mapped
              </span>
            </div>
            <p className="text-sm font-medium text-slate-700">{g.controlName}</p>
            {g.gaps.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {g.gaps.map((gap, i) => (
                  <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                    <span className="text-rose-400 shrink-0">•</span>
                    {gap}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

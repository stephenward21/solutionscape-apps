"use client";

import * as React from "react";
import type { EvidenceValidationResult, EvidenceValidationItem, EvidenceAdequacy } from "@/lib/types";

const ADEQUACY_CONFIG: Record<EvidenceAdequacy, { label: string; badge: string; bar: string }> = {
  ADEQUATE:   { label: "Adequate",   badge: "bg-green-100 text-green-700",  bar: "bg-green-500" },
  PARTIAL:    { label: "Partial",    badge: "bg-amber-100 text-amber-700",  bar: "bg-amber-400" },
  INADEQUATE: { label: "Inadequate", badge: "bg-red-100 text-red-700",      bar: "bg-red-500" },
  UNRELATED:  { label: "Unrelated",  badge: "bg-slate-100 text-slate-500",  bar: "bg-slate-300" },
};

interface Props {
  workspaceId: number;
}

export default function EvidencePanel({ workspaceId }: Props) {
  const [result, setResult] = React.useState<EvidenceValidationResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());

  // On mount, check for a cached result
  React.useEffect(() => {
    fetch(`/api/client/${workspaceId}/evidence-validation`)
      .then((r) => r.json())
      .then((d: { cached: EvidenceValidationResult | null }) => {
        if (d.cached) setResult(d.cached);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  function runValidation() {
    setRunning(true);
    setError(null);
    fetch(`/api/client/${workspaceId}/evidence-validation`, { method: "POST" })
      .then((r) => r.json())
      .then((data: EvidenceValidationResult & { error?: string }) => {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setRunning(false));
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <svg className="animate-spin w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-600 font-medium">Claude is reading your evidence files…</p>
        <p className="text-xs text-slate-400">
          Downloading each file and validating against mapped controls.
          This may take a few minutes for large evidence libraries.
        </p>
      </div>
    );
  }

  // No results yet — show the prompt to run
  if (!result) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl">🔍</div>
        <div className="text-center">
          <p className="text-slate-700 font-semibold mb-1">Evidence Validation</p>
          <p className="text-sm text-slate-500 max-w-sm">
            Claude will download each evidence file from Drata&apos;s Evidence Library and validate
            whether it actually demonstrates compliance with its mapped controls.
          </p>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 max-w-md text-center">
            {error}
          </div>
        )}
        <button
          onClick={runValidation}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl px-5 py-2.5 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Run Evidence Validation
        </button>
      </div>
    );
  }

  // Stats
  const total = result.validatedCount + result.skippedCount;
  const adequacyPct = result.validatedCount > 0
    ? Math.round((result.adequateCount / (result.adequateCount + result.partialCount + result.inadequateCount + result.unrelatedCount || 1)) * 100)
    : 0;

  const validated = result.items.filter((i) => !i.skipped);
  const skipped = result.items.filter((i) => i.skipped);

  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox label="Total Evidence" value={result.totalEvidenceItems} color="text-slate-700" bg="bg-slate-50" />
        <StatBox label="Validated" value={result.validatedCount} color="text-blue-600" bg="bg-blue-50" />
        <StatBox label="Adequate" value={result.adequateCount} color="text-green-600" bg="bg-green-50" />
        <StatBox label="Partial/Inadequate" value={result.partialCount + result.inadequateCount} color="text-amber-600" bg="bg-amber-50" />
        <StatBox label="Skipped" value={result.skippedCount} color="text-slate-500" bg="bg-slate-50" />
      </div>

      {/* Adequacy progress */}
      {result.validatedCount > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Evidence Adequacy</span>
            <span className="text-sm font-bold text-slate-800">{adequacyPct}%</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
            {[
              { count: result.adequateCount, color: "bg-green-500" },
              { count: result.partialCount, color: "bg-amber-400" },
              { count: result.inadequateCount, color: "bg-red-500" },
              { count: result.unrelatedCount, color: "bg-slate-300" },
            ].map(({ count, color }, i) => {
              const pct = total > 0 ? (count / total) * 100 : 0;
              return pct > 0 ? <div key={i} className={`${color} h-full`} style={{ width: `${pct}%` }} /> : null;
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Adequate ({result.adequateCount})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Partial ({result.partialCount})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Inadequate ({result.inadequateCount})</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" />Unrelated ({result.unrelatedCount})</span>
          </div>
        </div>
      )}

      {/* Header row with re-run */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Validated {new Date(result.generatedAt).toLocaleString()}
        </p>
        <button
          onClick={runValidation}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          ↺ Re-run Validation
        </button>
      </div>

      {/* Validated items */}
      {validated.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Validated Files ({validated.length})</p>
          {validated.map((item) => (
            <EvidenceItemCard
              key={item.evidenceId}
              item={item}
              expanded={expanded.has(item.evidenceId)}
              onToggle={() => toggleExpanded(item.evidenceId)}
            />
          ))}
        </div>
      )}

      {/* Skipped items */}
      {skipped.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Skipped ({skipped.length})</p>
          {skipped.map((item) => (
            <div key={item.evidenceId} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <span className="text-lg">📎</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-600 truncate">{item.evidenceName}</p>
                <p className="text-xs text-slate-400">{item.skipReason}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function EvidenceItemCard({
  item,
  expanded,
  onToggle,
}: {
  item: EvidenceValidationItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const worstAdequacy = (): EvidenceAdequacy => {
    const order: EvidenceAdequacy[] = ["INADEQUATE", "UNRELATED", "PARTIAL", "ADEQUATE"];
    const adequacies = item.controlValidations.map((cv) => cv.adequacy);
    for (const a of order) { if (adequacies.includes(a)) return a; }
    return "ADEQUATE";
  };
  const overall = worstAdequacy();
  const cfg = ADEQUACY_CONFIG[overall];

  const fileIcon = item.mimeType === "application/pdf" ? "📄" : "🖼️";

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xl mt-0.5 shrink-0">{fileIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400">
              {item.controlValidations.length} control{item.controlValidations.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{item.evidenceName}</p>
          {item.fileDescription && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.fileDescription}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {expanded && item.controlValidations.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {item.controlValidations.map((cv) => {
            const c = ADEQUACY_CONFIG[cv.adequacy];
            return (
              <div key={cv.controlId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>{c.label}</span>
                  <span className="text-xs font-mono text-slate-400">{cv.controlCode}</span>
                  {cv.frameworkTags.map((t) => (
                    <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{t}</span>
                  ))}
                  <span className="text-xs text-slate-400 ml-auto">confidence: {cv.confidence}</span>
                </div>
                <p className="text-xs font-medium text-slate-700">{cv.controlName}</p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{cv.finding}</p>
                {cv.gaps.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {cv.gaps.map((g, i) => (
                      <li key={i} className="text-xs text-slate-500 flex gap-1.5">
                        <span className="text-red-400 shrink-0">•</span>{g}
                      </li>
                    ))}
                  </ul>
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
}

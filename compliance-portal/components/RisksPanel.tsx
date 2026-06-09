"use client";
import type { DrataRisk, RiskSeverity } from "@/lib/types";
import { getRiskSeverity } from "@/lib/types";

const SEV_CONFIG: Record<RiskSeverity, { label: string; badge: string; bar: string }> = {
  CRITICAL: { label: "Critical", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
  HIGH: { label: "High", badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  MEDIUM: { label: "Medium", badge: "bg-sky-100 text-sky-700", bar: "bg-sky-500" },
  LOW: { label: "Low", badge: "bg-slate-100 text-slate-600", bar: "bg-slate-400" },
};

export default function RisksPanel({
  risks,
  loading,
}: {
  risks: DrataRisk[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading risks…</p>
      </div>
    );
  }

  if (!risks.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-emerald-600 font-medium">No active risks 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {risks.map((r) => {
        const sev = getRiskSeverity(r);
        const cfg = SEV_CONFIG[sev];
        const maxScore = 25; // 5×5 max
        const scoreWidth = Math.min(100, Math.round(((r.score ?? 0) / maxScore) * 100));

        return (
          <div
            key={r.id}
            className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  {r.score !== undefined && (
                    <span className="text-xs text-slate-400">Score: {r.score}</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">{r.title ?? "Untitled Risk"}</p>
              </div>
            </div>

            {/* Score bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
              <div
                className={`${cfg.bar} h-1.5 rounded-full transition-all`}
                style={{ width: `${scoreWidth}%` }}
              />
            </div>

            {r.treatmentPlan && (
              <div className="mt-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <span className="font-medium text-slate-600">Treatment: </span>
                {r.treatmentPlan}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

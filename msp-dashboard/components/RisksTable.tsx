"use client";

import type { DrataRisk, RiskSeverity } from "@/lib/types";
import { getRiskSeverity } from "@/lib/types";

interface Props {
  risks: DrataRisk[];
}

function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  const classes: Record<RiskSeverity, string> = {
    CRITICAL: "bg-red-600 text-white",
    HIGH: "bg-orange-500 text-white",
    MEDIUM: "bg-yellow-400 text-slate-800",
    LOW: "bg-blue-400 text-white",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classes[severity]}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ACTIVE: "bg-red-100 text-red-700",
    IN_TREATMENT: "bg-amber-100 text-amber-700",
    ARCHIVED: "bg-slate-100 text-slate-600",
    CLOSED: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    ACTIVE: "Active",
    IN_TREATMENT: "In Treatment",
    ARCHIVED: "Archived",
    CLOSED: "Closed",
  };
  const cls = classes[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

const SEVERITY_ORDER: Record<RiskSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export default function RisksTable({ risks }: Props) {
  const sorted = [...risks].sort(
    (a, b) => SEVERITY_ORDER[getRiskSeverity(a)] - SEVERITY_ORDER[getRiskSeverity(b)]
  );

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">No risks found</div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Name</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Severity</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Score</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Status</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Treatment</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                <span className="line-clamp-2">{r.title ?? "Untitled"}</span>
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <SeverityBadge severity={getRiskSeverity(r)} />
              </td>
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap font-mono text-xs">
                {r.score != null ? (
                  <span title={`Impact ${r.impact ?? "?"} × Likelihood ${r.likelihood ?? "?"}`}>
                    {r.score}/25
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                <StatusBadge status={r.status ?? ""} />
              </td>
              <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap text-xs">
                {r.treatmentPlan ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

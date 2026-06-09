"use client";
import type { AlertEvent, AlertSeverity, AlertTrigger } from "@/lib/types";

const SEV_CONFIG: Record<AlertSeverity, { badge: string; dot: string }> = {
  CRITICAL: { badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500" },
  HIGH: { badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  MEDIUM: { badge: "bg-sky-100 text-sky-700", dot: "bg-sky-400" },
  INFO: { badge: "bg-slate-100 text-slate-600", dot: "bg-slate-400" },
};

const TRIGGER_ICONS: Partial<Record<AlertTrigger, string>> = {
  NEW_FAILING_CONTROL: "🚨",
  NEW_OVERDUE_TASK: "📋",
  CRITICAL_RISK_OPENED: "🔴",
  HIGH_RISK_OPENED: "⚠️",
  FAILING_TEST: "🔬",
  CONTROL_NEEDS_OWNER: "👤",
  DAILY_DIGEST: "📊",
};

export default function EventHistory({
  events,
  loading,
}: {
  events: AlertEvent[];
  loading: boolean;
}) {
  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading history…</div>;
  if (!events.length) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-slate-600 font-medium">No alerts fired yet</p>
        <p className="text-sm text-slate-400 mt-1">Run a check to start generating alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
      {events.map((e) => {
        const cfg = SEV_CONFIG[e.severity];
        const icon = TRIGGER_ICONS[e.trigger] ?? "🔔";
        const hasError = !!e.error;

        return (
          <div
            key={e.id}
            className={`border rounded-xl p-4 ${hasError ? "border-rose-100 bg-rose-50/30" : "border-slate-100 hover:border-slate-200"}`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5 shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                    {e.severity}
                  </span>
                  <span className="text-xs text-slate-500">{e.workspaceName}</span>
                  <span className="text-xs text-slate-400 ml-auto">
                    {new Date(e.firedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 mb-1">{e.title}</p>
                <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed line-clamp-3">
                  {e.body}
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {e.channels.map((ch) => {
                    const status = e.deliveryStatus[ch];
                    return (
                      <span
                        key={ch}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          status === "SENT"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {ch}: {status}
                      </span>
                    );
                  })}
                  {hasError && (
                    <span className="text-xs text-rose-600 ml-2">⚠ {e.error}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";
import type { DrataTask } from "@/lib/types";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PAST_DUE: { label: "Overdue", badge: "bg-rose-50 text-rose-700" },
  INCOMPLETE: { label: "Incomplete", badge: "bg-amber-50 text-amber-700" },
  COMPLETED: { label: "Completed", badge: "bg-emerald-50 text-emerald-700" },
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (diff < 0) return `${label} (${Math.abs(diff)}d overdue)`;
  if (diff === 0) return `${label} (today)`;
  if (diff <= 7) return `${label} (${diff}d)`;
  return label;
}

export default function TasksPanel({
  tasks,
  loading,
}: {
  tasks: DrataTask[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading tasks…</p>
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-emerald-600 font-medium">No open tasks 🎉</p>
        <p className="text-xs text-slate-400 mt-1">All tasks are complete or not yet due.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
      {tasks.map((t) => {
        const status = t.status ?? "INCOMPLETE";
        const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["INCOMPLETE"];
        const assignee = t.assignee
          ? `${t.assignee.firstName ?? ""} ${t.assignee.lastName ?? ""}`.trim() ||
            t.assignee.email
          : "Unassigned";
        const dueDateStr = formatDate(t.dueDate);
        const isOverdue = status === "PAST_DUE" || (t.dueDate ? new Date(t.dueDate) < new Date() : false);

        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 border rounded-xl p-3.5 transition-colors ${
              isOverdue ? "border-rose-100 bg-rose-50/30" : "border-slate-100 hover:border-slate-200"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {isOverdue ? (
                <span className="text-base">🔴</span>
              ) : (
                <span className="text-base">🟡</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-800">{t.title}</p>
              <div className="flex flex-wrap gap-x-4 mt-1">
                <span className={`text-xs ${isOverdue ? "text-rose-600 font-medium" : "text-slate-400"}`}>
                  Due: {dueDateStr}
                </span>
                <span className="text-xs text-slate-400">Assignee: {assignee}</span>
              </div>
              {t.controls && t.controls.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {t.controls.map((c) => (
                    <span key={c.id} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      {c.code}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

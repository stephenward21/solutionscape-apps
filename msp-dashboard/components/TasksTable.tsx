"use client";

import type { DrataTask } from "@/lib/types";

interface Props {
  tasks: DrataTask[];
  type: "overdue" | "upcoming";
}

function formatDueDate(dueDate: string | undefined, type: "overdue" | "upcoming"): {
  text: string;
  className: string;
} {
  if (!dueDate) return { text: "No date", className: "text-slate-400" };

  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  let text: string;
  if (diffDays === 0) text = "Today";
  else if (diffDays === -1) text = "Yesterday";
  else if (diffDays < 0) text = `${Math.abs(diffDays)} days ago`;
  else if (diffDays === 1) text = "Tomorrow";
  else if (diffDays <= 7) text = `In ${diffDays} days`;
  else {
    text = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  let className: string;
  if (type === "overdue") {
    className = "text-red-600 font-medium";
  } else if (diffDays <= 7) {
    className = "text-amber-600 font-medium";
  } else {
    className = "text-slate-600";
  }

  return { text, className };
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    INCOMPLETE: "bg-blue-100 text-blue-700",
    PAST_DUE: "bg-red-100 text-red-700",
    COMPLETED: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    INCOMPLETE: "Incomplete",
    PAST_DUE: "Past Due",
    COMPLETED: "Completed",
  };
  const cls = classes[status] ?? "bg-slate-100 text-slate-600";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function TasksTable({ tasks, type }: Props) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        {type === "overdue" ? "No overdue tasks" : "No upcoming tasks"}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">
              Name
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600 whitespace-nowrap">
              Due Date
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">
              Assignee
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">
              Control
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {tasks.map((t) => {
            const { text, className } = formatDueDate(t.dueDate, type);
            return (
              <tr
                key={t.id}
                className={type === "overdue" ? "bg-red-50/50" : "hover:bg-slate-50"}
              >
                <td className="px-4 py-2.5 text-slate-800 max-w-xs">
                  <span className="line-clamp-2">{t.title}</span>
                </td>
                <td className={`px-4 py-2.5 whitespace-nowrap ${className}`}>
                  {text}
                </td>
                <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                  {t.assignee ? [t.assignee.firstName, t.assignee.lastName].filter(Boolean).join(" ") || t.assignee.email || "—" : "—"}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">
                  {t.controls?.[0]?.code ?? "—"}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <StatusBadge status={t.status ?? "INCOMPLETE"} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

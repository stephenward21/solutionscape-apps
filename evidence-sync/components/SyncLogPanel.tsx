"use client";

import type { SyncLogEntry } from "@/lib/types";

interface SyncLogPanelProps {
  entries: SyncLogEntry[];
  onClear: () => void;
}

const STATUS_ICONS: Record<SyncLogEntry["status"], string> = {
  success: "✅",
  error: "❌",
  skipped: "⏭",
};

export default function SyncLogPanel({ entries, onClear }: SyncLogPanelProps) {
  const shown = entries.slice(0, 50);

  return (
    <div className="bg-white border border-slate-200 rounded-xl">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">
          Sync Log{" "}
          <span className="font-normal text-slate-500">
            ({shown.length} of {entries.length})
          </span>
        </h3>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Clear Log
          </button>
        )}
      </div>

      {shown.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          No uploads yet. Uploads will appear here as you sync evidence.
        </div>
      )}

      <ul className="divide-y divide-slate-100">
        {shown.map((entry) => (
          <li key={entry.id} className="px-4 py-2.5 flex items-start gap-2 hover:bg-slate-50">
            <span className="mt-0.5 flex-shrink-0">{STATUS_ICONS[entry.status]}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-800 truncate">
                  {entry.fileName}
                </span>
                <span className="text-xs text-slate-500">→</span>
                <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  {entry.controlCode || `ID:${entry.controlId}`}
                </span>
                <span className="text-xs text-slate-500">—</span>
                <span className="text-xs text-slate-600">{entry.workspaceName}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-400">
                  {new Date(entry.uploadedAt).toLocaleString()}
                </span>
                {entry.status === "error" && entry.errorMessage && (
                  <span className="text-xs text-red-600 truncate">{entry.errorMessage}</span>
                )}
                {entry.status === "skipped" && entry.errorMessage && (
                  <span className="text-xs text-slate-500 truncate">{entry.errorMessage}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

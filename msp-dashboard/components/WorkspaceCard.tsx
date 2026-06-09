"use client";

import { useRouter } from "next/navigation";
import type { WorkspaceSnapshot } from "@/lib/types";
import FrameworkBar from "./FrameworkBar";
import Sparkline from "./Sparkline";

interface Props {
  snapshot: WorkspaceSnapshot;
  refreshing: boolean;
  onRefresh: (id: number) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const RAG_COLORS = {
  green: { bar: "bg-green-500", score: "text-green-600", hex: "#22c55e" },
  amber: { bar: "bg-amber-400", score: "text-amber-500", hex: "#f59e0b" },
  red: { bar: "bg-red-500", score: "text-red-600", hex: "#ef4444" },
};

export default function WorkspaceCard({ snapshot, refreshing, onRefresh }: Props) {
  const router = useRouter();
  const rag = RAG_COLORS[snapshot.ragStatus];

  const handleCardClick = () => {
    router.push(`/client/${snapshot.workspaceId}`);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefresh(snapshot.workspaceId);
  };

  if (snapshot.error && !snapshot.capturedAt) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="p-5">
          <h3 className="font-semibold text-slate-800 mb-3">{snapshot.workspaceName}</h3>
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-3">
            <p className="font-medium mb-1">Failed to load data</p>
            <p className="text-xs">{snapshot.error}</p>
          </div>
          <button
            onClick={() => onRefresh(snapshot.workspaceId)}
            className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden group"
      onClick={handleCardClick}
    >
      {/* Loading overlay */}
      {(refreshing || snapshot.stale) && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10 rounded-2xl">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Refreshing…
          </div>
        </div>
      )}

      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${rag.bar} rounded-l-2xl`} />

      <div className="pl-4 pr-5 pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <h3
            className="font-semibold text-slate-800 text-sm leading-snug truncate"
            title={snapshot.workspaceName}
          >
            {snapshot.workspaceName}
          </h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              title="Force refresh"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <span className={`text-xl font-bold tabular-nums ${rag.score}`}>
              {snapshot.overallScore}%
            </span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 mb-3" />

        {/* Framework bars */}
        {snapshot.frameworks.length > 0 ? (
          <div className="space-y-2.5 mb-3">
            {snapshot.frameworks.slice(0, 4).map((fw) => (
              <FrameworkBar key={fw.slug} framework={fw} compact />
            ))}
          </div>
        ) : (
          <div className="text-xs text-slate-400 mb-3 italic">No framework data</div>
        )}

        {/* Sparkline trend */}
        <div className="mb-3 -mx-0.5">
          <Sparkline
            points={snapshot.history}
            width={240}
            height={36}
            color={rag.hex}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 text-xs text-slate-600 mb-3 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="text-red-500 font-bold">✗</span>
            <span className="font-semibold text-slate-800">{snapshot.failingControls}</span>
            <span className="text-slate-400">failing</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-amber-500">⏰</span>
            <span className="font-semibold text-slate-800">{snapshot.overdueTasksCount}</span>
            <span className="text-slate-400">overdue</span>
          </span>
          {snapshot.openHighRisks > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-orange-500">⚠</span>
              <span className="font-semibold text-slate-800">{snapshot.openHighRisks}</span>
              <span className="text-slate-400">high</span>
            </span>
          )}
          {snapshot.openCriticalRisks > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-red-600">●</span>
              <span className="font-semibold text-red-700">{snapshot.openCriticalRisks}</span>
              <span className="text-slate-400">crit</span>
            </span>
          )}
        </div>

        {snapshot.error && (
          <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-3">
            Warning: {snapshot.error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Refreshed {timeAgo(snapshot.capturedAt)}
          </span>
          <span className="text-xs text-blue-600 font-medium group-hover:underline flex items-center gap-0.5">
            View Details
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

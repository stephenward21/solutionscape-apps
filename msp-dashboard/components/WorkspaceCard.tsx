"use client";

import { useRouter } from "next/navigation";
import type { WorkspaceSnapshot } from "@/lib/types";
import RAGBadge from "./RAGBadge";
import FrameworkBar from "./FrameworkBar";
import Sparkline from "./Sparkline";
import StatsRow from "./StatsRow";

interface Props {
  snapshot: WorkspaceSnapshot;
  refreshing: boolean;
  onRefresh: (name: string) => void;
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

export default function WorkspaceCard({ snapshot, refreshing, onRefresh }: Props) {
  const router = useRouter();

  const handleCardClick = () => {
    router.push(`/client/${encodeURIComponent(snapshot.workspaceName)}`);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRefresh(snapshot.workspaceName);
  };

  if (snapshot.error && !snapshot.capturedAt) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-slate-800">{snapshot.workspaceName}</h3>
        </div>
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-3">
          <p className="font-medium mb-1">Failed to load data</p>
          <p className="text-xs">{snapshot.error}</p>
        </div>
        <button
          onClick={() => onRefresh(snapshot.workspaceName)}
          className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const ragColor =
    snapshot.ragStatus === "green"
      ? "#22c55e"
      : snapshot.ragStatus === "amber"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <div
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative overflow-hidden"
      onClick={handleCardClick}
    >
      {(refreshing || snapshot.stale) && (
        <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <svg
              className="animate-spin w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Refreshing…
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <RAGBadge status={snapshot.ragStatus} />
          <h3
            className="font-semibold text-slate-800 truncate"
            title={snapshot.workspaceName}
          >
            {snapshot.workspaceName}
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          title="Force refresh"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* Framework bars */}
      {snapshot.frameworks.length > 0 ? (
        <div className="space-y-2 mb-4">
          {snapshot.frameworks.slice(0, 4).map((fw) => (
            <FrameworkBar key={fw.slug} framework={fw} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-slate-400 mb-4 italic">No frameworks data</div>
      )}

      {/* Overall score */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl font-bold" style={{ color: ragColor }}>
          {snapshot.overallScore}%
        </span>
        <span className="text-xs text-slate-500">overall compliance</span>
      </div>

      {/* Sparkline */}
      <div className="mb-4 -mx-1">
        <Sparkline
          points={snapshot.history}
          width={220}
          height={40}
          color={ragColor}
        />
      </div>

      {/* Stats */}
      <div className="mb-4">
        <StatsRow snapshot={snapshot} />
      </div>

      {snapshot.error && (
        <div className="text-xs text-amber-600 bg-amber-50 rounded px-2 py-1 mb-3">
          Warning: {snapshot.error}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">
          Refreshed {timeAgo(snapshot.capturedAt)}
        </span>
        <button
          onClick={handleCardClick}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          View Details
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

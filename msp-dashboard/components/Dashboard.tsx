"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WorkspaceSnapshot } from "@/lib/types";
import WorkspaceCard from "./WorkspaceCard";

type SortKey = "name" | "score-desc" | "score-asc" | "failing" | "overdue";
type RagFilter = "all" | "green" | "amber" | "red";

function timeAgo(date: Date | null): string {
  if (!date) return "never";
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-sm animate-pulse overflow-hidden">
      <div className="h-1.5 bg-slate-200" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 bg-slate-200 rounded w-32" />
          <div className="h-6 w-12 bg-slate-200 rounded" />
        </div>
        <div className="space-y-3 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full" />
              <div className="h-3 bg-slate-200 rounded w-8" />
            </div>
          ))}
        </div>
        <div className="h-10 bg-slate-100 rounded mb-4" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-slate-100 rounded w-12" />
          ))}
        </div>
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
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
  );
}

export default function Dashboard() {
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [globalRefreshing, setGlobalRefreshing] = useState(false);
  const [refreshing, setRefreshing] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [ragFilter, setRagFilter] = useState<RagFilter>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSnapshots = useCallback(async () => {
    setGlobalRefreshing(true);
    try {
      const res = await fetch("/api/snapshots");
      if (!res.ok) throw new Error("Failed to load snapshots");
      const data = (await res.json()) as { snapshots: WorkspaceSnapshot[] };
      setSnapshots(data.snapshots);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Error loading snapshots:", err);
    } finally {
      setLoading(false);
      setGlobalRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
    intervalRef.current = setInterval(() => void loadSnapshots(), 15 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadSnapshots]);

  const handleForceRefresh = async (workspaceId: number) => {
    setRefreshing((prev) => new Set(prev).add(workspaceId));
    try {
      const res = await fetch(`/api/client/${workspaceId}/snapshot`);
      if (!res.ok) throw new Error("Refresh failed");
      const fresh = (await res.json()) as WorkspaceSnapshot;
      setSnapshots((prev) =>
        prev.map((s) => (s.workspaceId === workspaceId ? fresh : s))
      );
    } catch (err) {
      console.error("Error refreshing workspace:", err);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    }
  };

  // Aggregate stats
  const overallScore =
    snapshots.length > 0
      ? Math.round(snapshots.reduce((sum, s) => sum + s.overallScore, 0) / snapshots.length)
      : 0;
  const totalFailing = snapshots.reduce((sum, s) => sum + s.failingControls, 0);
  const totalOverdue = snapshots.reduce((sum, s) => sum + s.overdueTasksCount, 0);
  const totalCritical = snapshots.reduce((sum, s) => sum + s.openCriticalRisks, 0);

  // Filter
  const filtered = snapshots.filter(
    (s) => ragFilter === "all" || s.ragStatus === ragFilter
  );

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return a.workspaceName.localeCompare(b.workspaceName);
      case "score-desc":
        return b.overallScore - a.overallScore;
      case "score-asc":
        return a.overallScore - b.overallScore;
      case "failing":
        return b.failingControls - a.failingControls;
      case "overdue":
        return b.overdueTasksCount - a.overdueTasksCount;
    }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dark header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">MSP Compliance Dashboard</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {snapshots.length > 0
                ? `${snapshots.length} workspace${snapshots.length !== 1 ? "s" : ""} monitored`
                : "Loading workspaces…"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:block">
              Updated {timeAgo(lastRefreshed)}
            </span>
            <button
              onClick={() => void loadSnapshots()}
              disabled={globalRefreshing}
              className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <RefreshIcon spinning={globalRefreshing} />
              Refresh All
            </button>
          </div>
        </div>

        {/* Aggregate stat strip */}
        {!loading && snapshots.length > 0 && (
          <div className="bg-slate-800 border-t border-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap gap-6">
              <StatStrip label="Workspaces" value={snapshots.length} />
              <StatStrip
                label="Avg Score"
                value={`${overallScore}%`}
                color={
                  overallScore >= 90
                    ? "text-green-400"
                    : overallScore >= 70
                    ? "text-amber-400"
                    : "text-red-400"
                }
              />
              <StatStrip label="Failing Controls" value={totalFailing} color={totalFailing > 0 ? "text-red-400" : "text-slate-300"} />
              <StatStrip label="Overdue Tasks" value={totalOverdue} color={totalOverdue > 0 ? "text-amber-400" : "text-slate-300"} />
              <StatStrip label="Critical Risks" value={totalCritical} color={totalCritical > 0 ? "text-red-400" : "text-slate-300"} />
            </div>
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Filter/sort bar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sort</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="name">Name A–Z</option>
              <option value="score-desc">Score (High first)</option>
              <option value="score-asc">Score (Low first)</option>
              <option value="failing">Most Failing</option>
              <option value="overdue">Most Overdue</option>
            </select>
          </div>
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Filter</label>
            {(["all", "red", "amber", "green"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRagFilter(f)}
                className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                  ragFilter === f
                    ? f === "green"
                      ? "bg-green-600 text-white border-green-600"
                      : f === "amber"
                      ? "bg-amber-500 text-white border-amber-500"
                      : f === "red"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f === "all"
                  ? "All"
                  : f === "red"
                  ? "At Risk"
                  : f === "amber"
                  ? "Attention"
                  : "Healthy"}
              </button>
            ))}
          </div>
        </div>

        {/* Card grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <p className="text-lg font-medium mb-2">No workspaces to display</p>
            <p className="text-sm">
              {ragFilter !== "all"
                ? "Try changing the filter above."
                : "Configure DRATA_API_KEY or DRATA_TENANTS to get started."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((snapshot) => (
              <WorkspaceCard
                key={snapshot.workspaceId}
                snapshot={snapshot}
                refreshing={refreshing.has(snapshot.workspaceId)}
                onRefresh={(id) => void handleForceRefresh(id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatStrip({
  label,
  value,
  color = "text-slate-300",
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-lg font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

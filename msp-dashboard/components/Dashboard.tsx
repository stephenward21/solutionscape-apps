"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WorkspaceSnapshot } from "@/lib/types";
import WorkspaceCard from "./WorkspaceCard";

interface Props {
  workspaceNames: string[];
}

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
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 bg-slate-200 rounded w-24" />
        <div className="h-4 w-4 bg-slate-200 rounded" />
      </div>
      <div className="space-y-2 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-2 bg-slate-200 rounded w-20" />
            <div className="flex-1 h-2 bg-slate-200 rounded" />
            <div className="h-2 bg-slate-200 rounded w-8" />
          </div>
        ))}
      </div>
      <div className="h-8 bg-slate-200 rounded w-16 mb-3" />
      <div className="h-10 bg-slate-100 rounded mb-4" />
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-slate-100 rounded" />
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ workspaceNames }: Props) {
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [ragFilter, setRagFilter] = useState<RagFilter>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSnapshots = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
    intervalRef.current = setInterval(() => void loadSnapshots(), 15 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadSnapshots]);

  const handleForceRefresh = async (workspaceName: string) => {
    setRefreshing((prev) => new Set(prev).add(workspaceName));
    try {
      const res = await fetch(
        `/api/client/${encodeURIComponent(workspaceName)}/snapshot`
      );
      if (!res.ok) throw new Error("Refresh failed");
      const fresh = (await res.json()) as WorkspaceSnapshot;
      setSnapshots((prev) =>
        prev.map((s) => (s.workspaceName === workspaceName ? fresh : s))
      );
    } catch (err) {
      console.error("Error refreshing workspace:", err);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(workspaceName);
        return next;
      });
    }
  };

  // Aggregate stats
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
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            MSP Compliance Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {workspaceNames.length} workspace{workspaceNames.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            Last updated: {timeAgo(lastRefreshed)}
          </span>
          <button
            onClick={() => void loadSnapshots()}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
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
            Refresh
          </button>
        </div>
      </div>

      {/* Aggregate stats */}
      {!loading && snapshots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatBox label="Workspaces" value={snapshots.length} color="text-slate-800" />
          <StatBox label="Failing Controls" value={totalFailing} color="text-red-600" />
          <StatBox label="Overdue Tasks" value={totalOverdue} color="text-amber-600" />
          <StatBox
            label="Critical Risks"
            value={totalCritical}
            color="text-red-700"
          />
        </div>
      )}

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Sort:</label>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="name">Name A-Z</option>
            <option value="score-desc">Score (High)</option>
            <option value="score-asc">Score (Low)</option>
            <option value="failing">Most Failing</option>
            <option value="overdue">Most Overdue</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-500">Filter:</span>
          {(["all", "red", "amber", "green"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setRagFilter(f)}
              className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                ragFilter === f
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "red"
                ? "🔴 Red"
                : f === "amber"
                ? "🟡 Amber"
                : "🟢 Green"}
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
        <div className="text-center py-16 text-slate-400">
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
              key={snapshot.workspaceName}
              snapshot={snapshot}
              refreshing={refreshing.has(snapshot.workspaceName)}
              onRefresh={(name) => void handleForceRefresh(name)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

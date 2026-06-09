"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkspaceSnapshot,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataEvent,
} from "@/lib/types";
import { getOverdueTasks, getUpcomingTasks } from "@/lib/health-calculator";
import RAGBadge from "./RAGBadge";
import FrameworkBar from "./FrameworkBar";
import Sparkline from "./Sparkline";
import ControlsTable from "./ControlsTable";
import TasksTable from "./TasksTable";
import RisksTable from "./RisksTable";
import EventsLog from "./EventsLog";

interface Props {
  workspaceName: string;
}

type TabKey = "overview" | "controls" | "tasks" | "risks" | "events";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "controls", label: "Controls" },
  { key: "tasks", label: "Tasks" },
  { key: "risks", label: "Risks" },
  { key: "events", label: "Events" },
];

type ControlFilter = "all" | "FAILING" | "NEEDS_ATTENTION" | "PASSING";
type RiskSeverityFilter = "all" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <svg className="animate-spin w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export default function ClientDetail({ workspaceName }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Snapshot data (for overview)
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  // Tab-specific data
  const [controls, setControls] = useState<DrataControl[]>([]);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [controlFilter, setControlFilter] = useState<ControlFilter>("all");
  const [controlFrameworkFilter, setControlFrameworkFilter] = useState<string>("all");

  const [allTasks, setAllTasks] = useState<DrataTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  const [risks, setRisks] = useState<DrataRisk[]>([]);
  const [risksLoading, setRisksLoading] = useState(false);
  const [riskSeverityFilter, setRiskSeverityFilter] =
    useState<RiskSeverityFilter>("all");

  const [events, setEvents] = useState<DrataEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const encoded = encodeURIComponent(workspaceName);

  const loadSnapshot = useCallback(async () => {
    setSnapshotLoading(true);
    try {
      const res = await fetch(`/api/client/${encoded}/snapshot`);
      const data = (await res.json()) as WorkspaceSnapshot;
      setSnapshot(data);
    } catch {
      // keep existing snapshot
    } finally {
      setSnapshotLoading(false);
    }
  }, [encoded]);

  const loadControls = useCallback(async () => {
    setControlsLoading(true);
    try {
      const res = await fetch(`/api/client/${encoded}/controls`);
      const data = (await res.json()) as { controls: DrataControl[] };
      setControls(data.controls ?? []);
    } catch {
      setControls([]);
    } finally {
      setControlsLoading(false);
    }
  }, [encoded]);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/client/${encoded}/tasks`);
      const data = (await res.json()) as {
        tasks: DrataTask[];
        overdueCount: number;
        upcomingCount: number;
      };
      setAllTasks(data.tasks ?? []);
      setOverdueCount(data.overdueCount ?? 0);
      setUpcomingCount(data.upcomingCount ?? 0);
    } catch {
      setAllTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [encoded]);

  const loadRisks = useCallback(async () => {
    setRisksLoading(true);
    try {
      const res = await fetch(`/api/client/${encoded}/risks`);
      const data = (await res.json()) as { risks: DrataRisk[] };
      setRisks(data.risks ?? []);
    } catch {
      setRisks([]);
    } finally {
      setRisksLoading(false);
    }
  }, [encoded]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/client/${encoded}/events`);
      const data = (await res.json()) as { events: DrataEvent[] };
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [encoded]);

  // Load snapshot on mount
  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  // Load tab data lazily
  useEffect(() => {
    if (activeTab === "controls" && controls.length === 0 && !controlsLoading) {
      void loadControls();
    } else if (activeTab === "tasks" && allTasks.length === 0 && !tasksLoading) {
      void loadTasks();
    } else if (activeTab === "risks" && risks.length === 0 && !risksLoading) {
      void loadRisks();
    } else if (activeTab === "events" && events.length === 0 && !eventsLoading) {
      void loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSnapshot();
    // Also clear cached tab data so it reloads
    setControls([]);
    setAllTasks([]);
    setRisks([]);
    setEvents([]);
    if (activeTab === "controls") await loadControls();
    else if (activeTab === "tasks") await loadTasks();
    else if (activeTab === "risks") await loadRisks();
    else if (activeTab === "events") await loadEvents();
    setRefreshing(false);
  };

  const ragColor =
    snapshot?.ragStatus === "green"
      ? "#22c55e"
      : snapshot?.ragStatus === "amber"
      ? "#f59e0b"
      : "#ef4444";

  // Derive filtered controls
  const filteredControls = controls.filter((c) => {
    const statusMatch = controlFilter === "all" || c.status === controlFilter;
    const frameworkMatch =
      controlFrameworkFilter === "all" ||
      c.frameworkSlug === controlFrameworkFilter;
    return statusMatch && frameworkMatch;
  });

  const frameworks = snapshot?.frameworks ?? [];
  const frameworkSlugs = Array.from(new Set(controls.map((c) => c.frameworkSlug).filter((s): s is string => Boolean(s))));

  // Filtered risks
  const filteredRisks = risks.filter(
    (r) => riskSeverityFilter === "all" || r.severity === riskSeverityFilter
  );

  // Tasks split
  const overdueTasks = getOverdueTasks(allTasks);
  const upcomingTasks = getUpcomingTasks(allTasks);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* Back button + header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex items-center gap-2">
            {snapshot && <RAGBadge status={snapshot.ragStatus} size="md" />}
            <h1 className="text-xl font-bold text-slate-900">{workspaceName}</h1>
          </div>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={refreshing || snapshotLoading}
          className="flex items-center gap-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {snapshotLoading ? (
            <LoadingSpinner />
          ) : snapshot ? (
            <>
              {snapshot.error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                  <strong>Warning:</strong> {snapshot.error}
                </div>
              )}

              {/* Score + sparkline */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Overall Compliance Score
                  </h2>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="text-5xl font-bold" style={{ color: ragColor }}>
                      {snapshot.overallScore}%
                    </span>
                    <RAGBadge status={snapshot.ragStatus} size="md" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-green-600">{snapshot.passingControls}</p>
                      <p className="text-xs text-slate-500">Passing</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{snapshot.needsAttentionControls}</p>
                      <p className="text-xs text-slate-500">Needs Attn</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-red-600">{snapshot.failingControls}</p>
                      <p className="text-xs text-slate-500">Failing</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    30-Day Trend
                  </h2>
                  <Sparkline
                    points={snapshot.history}
                    width={320}
                    height={80}
                    color={ragColor}
                  />
                </div>
              </div>

              {/* Frameworks */}
              {frameworks.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">
                    Framework Health
                  </h2>
                  <div className="space-y-3">
                    {frameworks.map((fw) => (
                      <FrameworkBar key={fw.slug} framework={fw} />
                    ))}
                  </div>
                </div>
              )}

              {/* Summary counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SummaryBox label="Overdue Tasks" value={snapshot.overdueTasksCount} color="text-red-600" />
                <SummaryBox label="Upcoming Tasks" value={snapshot.upcomingTasksCount} color="text-amber-600" />
                <SummaryBox label="Open High Risks" value={snapshot.openHighRisks} color="text-orange-600" />
                <SummaryBox label="Critical Risks" value={snapshot.openCriticalRisks} color="text-red-700" />
              </div>

              {/* Recent events preview */}
              {snapshot.recentEvents.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                      Recent Activity
                    </h2>
                    <button
                      onClick={() => setActiveTab("events")}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View all
                    </button>
                  </div>
                  <EventsLog events={snapshot.recentEvents} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-slate-400">Failed to load overview</div>
          )}
        </div>
      )}

      {activeTab === "controls" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            {/* Status filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["all", "FAILING", "NEEDS_ATTENTION", "PASSING"] as ControlFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setControlFilter(f)}
                  className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                    controlFilter === f
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {f === "all" ? "All" : f.replace("_", " ")}
                </button>
              ))}
            </div>
            {/* Framework filter */}
            {frameworkSlugs.length > 0 && (
              <select
                value={controlFrameworkFilter}
                onChange={(e) => setControlFrameworkFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Frameworks</option>
                {frameworkSlugs.map((slug) => (
                  <option key={slug} value={slug}>
                    {slug}
                  </option>
                ))}
              </select>
            )}
          </div>
          {controlsLoading ? (
            <LoadingSpinner />
          ) : (
            <ControlsTable controls={filteredControls} />
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-8">
          {tasksLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-3">
                  Overdue ({overdueCount})
                </h3>
                <TasksTable tasks={overdueTasks} type="overdue" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800 mb-3">
                  Upcoming — Next 30 Days ({upcomingCount})
                </h3>
                <TasksTable tasks={upcomingTasks} type="upcoming" />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "risks" && (
        <div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {(["all", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as RiskSeverityFilter[]).map(
              (f) => (
                <button
                  key={f}
                  onClick={() => setRiskSeverityFilter(f)}
                  className={`text-sm px-2.5 py-1 rounded-lg border transition-colors ${
                    riskSeverityFilter === f
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {f === "all" ? "All" : f}
                </button>
              )
            )}
          </div>
          {risksLoading ? <LoadingSpinner /> : <RisksTable risks={filteredRisks} />}
        </div>
      )}

      {activeTab === "events" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          {eventsLoading ? (
            <LoadingSpinner />
          ) : (
            <EventsLog events={events} />
          )}
        </div>
      )}
    </main>
  );
}

function SummaryBox({
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

"use client";

import { useEffect, useState, useCallback } from "react";
import type { PortalSnapshot, AIPrioritiesResult, ActionItem, DrataControl, DrataTask, DrataRisk } from "@/lib/types";
import { getControlStatus, getRiskSeverity } from "@/lib/types";
import ScoreRing from "./ScoreRing";
import FrameworkGrid from "./FrameworkGrid";
import AIPriorities from "./AIPriorities";
import ControlsPanel from "./ControlsPanel";
import TasksPanel from "./TasksPanel";
import RisksPanel from "./RisksPanel";

type Tab = "overview" | "controls" | "tasks" | "risks";

const RAG_COLORS = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
};

const RAG_TEXT = {
  green: "On Track",
  amber: "Needs Attention",
  red: "At Risk",
};

export default function PortalView({ token }: { token: string }) {
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [priorities, setPriorities] = useState<AIPrioritiesResult | null>(null);
  const [controls, setControls] = useState<DrataControl[]>([]);
  const [tasks, setTasks] = useState<DrataTask[]>([]);
  const [risks, setRisks] = useState<DrataRisk[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loadingSnapshot, setLoadingSnapshot] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingRisks, setLoadingRisks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load snapshot on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}/snapshot`);
        const data = (await res.json()) as PortalSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load portal");
        setSnapshot(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingSnapshot(false);
      }
    }
    void load();
  }, [token]);

  // Load AI priorities after snapshot loads
  useEffect(() => {
    if (!snapshot) return;
    setLoadingAI(true);
    fetch(`/api/portal/${token}/ai-priorities`)
      .then((r) => r.json())
      .then((data: AIPrioritiesResult & { error?: string }) => {
        if (data.error) console.warn("AI priorities error:", data.error);
        else setPriorities(data);
      })
      .catch(console.error)
      .finally(() => setLoadingAI(false));
  }, [snapshot, token]);

  const loadControls = useCallback(() => {
    if (controls.length > 0) return;
    setLoadingControls(true);
    fetch(`/api/portal/${token}/controls`)
      .then((r) => r.json())
      .then((d: { controls?: DrataControl[] }) => setControls(d.controls ?? []))
      .catch(console.error)
      .finally(() => setLoadingControls(false));
  }, [token, controls.length]);

  const loadTasks = useCallback(() => {
    if (tasks.length > 0) return;
    setLoadingTasks(true);
    fetch(`/api/portal/${token}/tasks`)
      .then((r) => r.json())
      .then((d: { tasks?: DrataTask[] }) => setTasks(d.tasks ?? []))
      .catch(console.error)
      .finally(() => setLoadingTasks(false));
  }, [token, tasks.length]);

  const loadRisks = useCallback(() => {
    if (risks.length > 0) return;
    setLoadingRisks(true);
    fetch(`/api/portal/${token}/risks`)
      .then((r) => r.json())
      .then((d: { risks?: DrataRisk[] }) => setRisks(d.risks ?? []))
      .catch(console.error)
      .finally(() => setLoadingRisks(false));
  }, [token, risks.length]);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "controls") loadControls();
    if (tab === "tasks") loadTasks();
    if (tab === "risks") loadRisks();
  }

  function refreshAI() {
    setLoadingAI(true);
    fetch(`/api/portal/${token}/ai-priorities?refresh=true`)
      .then((r) => r.json())
      .then((data: AIPrioritiesResult & { error?: string }) => {
        if (!data.error) setPriorities(data);
      })
      .catch(console.error)
      .finally(() => setLoadingAI(false));
  }

  if (loadingSnapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading your compliance portal…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center bg-white rounded-2xl shadow p-8">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">Portal Unavailable</h2>
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;
  const rag = snapshot.ragStatus;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-800 leading-tight">{snapshot.portalLabel}</div>
                <div className="text-xs text-slate-400">Compliance Dashboard</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-white ${RAG_COLORS[rag]}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/70 animate-pulse" />
                {RAG_TEXT[rag]}
              </span>
              <span className="text-xs text-slate-400">
                Updated {new Date(snapshot.capturedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Score + stats strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Score ring */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-4 md:col-span-1">
            <ScoreRing score={snapshot.overallScore} rag={rag} />
            <div>
              <div className="text-2xl font-bold text-slate-800">{snapshot.overallScore}%</div>
              <div className="text-sm text-slate-500">Overall Score</div>
            </div>
          </div>

          {/* Stat cards */}
          <StatCard
            label="Controls"
            value={snapshot.passingControls}
            total={snapshot.totalControls}
            sub={`${snapshot.failingControls} failing · ${snapshot.needsAttentionControls} needs attention`}
            color="text-emerald-600"
          />
          <StatCard
            label="Overdue Tasks"
            value={snapshot.overdueTasksCount}
            sub={`${snapshot.upcomingTasksCount} due in 14 days`}
            color={snapshot.overdueTasksCount > 0 ? "text-rose-600" : "text-emerald-600"}
          />
          <StatCard
            label="Critical / High Risks"
            value={snapshot.openCriticalRisks + snapshot.openHighRisks}
            sub={`${snapshot.openCriticalRisks} critical · ${snapshot.openHighRisks} high`}
            color={snapshot.openCriticalRisks > 0 ? "text-rose-600" : snapshot.openHighRisks > 0 ? "text-amber-600" : "text-emerald-600"}
          />
        </div>

        {/* Framework health */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Framework Compliance
          </h2>
          <FrameworkGrid frameworks={snapshot.frameworks} />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="border-b border-slate-100 px-6">
            <nav className="flex gap-1 -mb-px">
              {(["overview", "controls", "tasks", "risks"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  className={`px-4 py-3.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab === "overview" ? "AI Priorities" : tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && (
              <AIPriorities
                priorities={priorities}
                loading={loadingAI}
                onRefresh={refreshAI}
              />
            )}
            {activeTab === "controls" && (
              <ControlsPanel controls={controls} loading={loadingControls} />
            )}
            {activeTab === "tasks" && (
              <TasksPanel tasks={tasks} loading={loadingTasks} />
            )}
            {activeTab === "risks" && (
              <RisksPanel risks={risks} loading={loadingRisks} />
            )}
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Powered by{" "}
          <a href="https://solutionscape.ai" className="hover:text-brand-600 transition-colors">
            Solutionscape
          </a>{" "}
          · Data from Drata · AI analysis by Claude
        </footer>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  sub,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color} mb-1`}>
        {value}
        {total !== undefined && (
          <span className="text-lg font-medium text-slate-400">/{total}</span>
        )}
      </div>
      <div className="text-xs text-slate-400">{sub}</div>
    </div>
  );
}

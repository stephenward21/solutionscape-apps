import type { WorkspaceSnapshot } from "./types";
import { getControlStatus } from "./types";
import { getClient } from "./drata-client";
import {
  calculateFrameworkHealth,
  calculateOverallScore,
  getRagStatus,
  getOverdueTasks,
  getUpcomingTasks,
  countOpenRisksBySeverity,
} from "./health-calculator";
import { saveSnapshot, loadSnapshot } from "./snapshot-store";

export async function buildFreshSnapshot(
  workspaceName: string
): Promise<WorkspaceSnapshot> {
  const client = getClient(workspaceName);

  const [frameworks, controls, tasks, risks, tests, events] = await Promise.all([
    client.getFrameworks(),
    client.getControls(),
    client.getTasks(),
    client.getRisks(),
    client.getMonitoringTests(),
    client.getEvents(20),
  ]);

  const frameworkHealthList = frameworks.map((fw) =>
    calculateFrameworkHealth(controls, fw)
  );

  const overallScore = calculateOverallScore(frameworkHealthList);
  const ragStatus = getRagStatus(overallScore);

  const passing = controls.filter((c) => getControlStatus(c) === "PASSING").length;
  const failing = controls.filter((c) => getControlStatus(c) === "FAILING").length;
  const needsAttention = controls.filter(
    (c) => getControlStatus(c) === "NEEDS_ATTENTION"
  ).length;

  const overdue = getOverdueTasks(tasks);
  const upcoming = getUpcomingTasks(tasks);
  const { high, critical } = countOpenRisksBySeverity(risks);
  // v2 monitoring tests use checkResultStatus
  const failingTests = tests.filter((t) => t.checkResultStatus === "FAILED").length;

  // Load existing history so it can be preserved by saveSnapshot
  const existing = loadSnapshot(workspaceName);
  const existingHistory = existing?.history ?? [];

  const snapshot: WorkspaceSnapshot = {
    workspaceName,
    capturedAt: new Date().toISOString(),
    stale: false,
    frameworks: frameworkHealthList,
    overallScore,
    ragStatus,
    totalControls: controls.length,
    passingControls: passing,
    failingControls: failing,
    needsAttentionControls: needsAttention,
    overdueTasksCount: overdue.length,
    upcomingTasksCount: upcoming.length,
    openHighRisks: high,
    openCriticalRisks: critical,
    failingTestsCount: failingTests,
    recentEvents: events.slice(0, 5),
    history: existingHistory, // will be updated by saveSnapshot
  };

  saveSnapshot(snapshot);

  // Return the saved version (with updated history)
  return loadSnapshot(workspaceName) ?? snapshot;
}

export function buildErrorSnapshot(
  workspaceName: string,
  errorMessage: string,
  existing: WorkspaceSnapshot | null
): WorkspaceSnapshot {
  return {
    workspaceName,
    capturedAt: existing?.capturedAt ?? new Date().toISOString(),
    stale: true,
    frameworks: existing?.frameworks ?? [],
    overallScore: existing?.overallScore ?? 0,
    ragStatus: existing?.ragStatus ?? "red",
    totalControls: existing?.totalControls ?? 0,
    passingControls: existing?.passingControls ?? 0,
    failingControls: existing?.failingControls ?? 0,
    needsAttentionControls: existing?.needsAttentionControls ?? 0,
    overdueTasksCount: existing?.overdueTasksCount ?? 0,
    upcomingTasksCount: existing?.upcomingTasksCount ?? 0,
    openHighRisks: existing?.openHighRisks ?? 0,
    openCriticalRisks: existing?.openCriticalRisks ?? 0,
    failingTestsCount: existing?.failingTestsCount ?? 0,
    recentEvents: existing?.recentEvents ?? [],
    history: existing?.history ?? [],
    error: errorMessage,
  };
}

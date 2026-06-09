import type { PortalSnapshot, FrameworkHealth, DrataFramework } from "./types";
import { getControlStatus, getRiskSeverity } from "./types";
import { makeClient } from "./drata-client";
import type { PortalConfig } from "./types";

function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function calculateFrameworkHealth(fw: DrataFramework): FrameworkHealth {
  const total = fw.numInScopeRequirements ?? 0;
  const passing = fw.numReadyInScopeRequirements ?? 0;
  const score = total > 0 ? Math.round((passing / total) * 100) : 0;
  return {
    id: fw.id,
    name: fw.name,
    slug: fw.slug ?? nameToSlug(fw.name),
    passingCount: passing,
    failingCount: total - passing,
    totalCount: total,
    score,
  };
}

function getRagStatus(score: number): "green" | "amber" | "red" {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function isOverdue(task: { status?: string; dueDate?: string }): boolean {
  if (task.status === "PAST_DUE") return true;
  if (task.dueDate && new Date(task.dueDate) < new Date()) return true;
  return false;
}

function isUpcoming(task: { status?: string; dueDate?: string }): boolean {
  if (!task.dueDate || task.status === "COMPLETED") return false;
  const due = new Date(task.dueDate);
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  return due >= now && due <= inTwoWeeks;
}

export async function buildSnapshot(config: PortalConfig): Promise<PortalSnapshot> {
  const client = makeClient(config.apiKey);

  const [frameworks, controls, tasks, risks, tests] = await Promise.all([
    client.getFrameworks(config.workspaceId),
    client.getControls(config.workspaceId),
    client.getTasks(config.workspaceId),
    config.showRisks ? client.getRisks() : Promise.resolve([]),
    client.getMonitoringTests(config.workspaceId),
  ]);

  const frameworkHealthList = frameworks.map(calculateFrameworkHealth);

  const totalScore =
    frameworkHealthList.length > 0
      ? Math.round(
          frameworkHealthList.reduce((sum, f) => sum + f.score, 0) /
            frameworkHealthList.length
        )
      : 0;

  const passing = controls.filter((c) => getControlStatus(c) === "PASSING").length;
  const failing = controls.filter((c) => getControlStatus(c) === "FAILING").length;
  const needsAttention = controls.filter((c) => getControlStatus(c) === "NEEDS_ATTENTION").length;
  const notApplicable = controls.filter((c) => getControlStatus(c) === "NOT_APPLICABLE").length;

  const overdueTasks = tasks.filter(isOverdue);
  const upcomingTasks = tasks.filter(isUpcoming);

  const activeRisks = risks.filter((r) => r.status === "ACTIVE");
  const highRisks = activeRisks.filter((r) => getRiskSeverity(r) === "HIGH").length;
  const criticalRisks = activeRisks.filter((r) => getRiskSeverity(r) === "CRITICAL").length;

  const failingTests = tests.filter((t) => t.checkResultStatus === "FAILED").length;

  return {
    workspaceId: config.workspaceId,
    workspaceName: config.workspaceName,
    portalLabel: config.label,
    capturedAt: new Date().toISOString(),
    stale: false,
    frameworks: frameworkHealthList,
    overallScore: totalScore,
    ragStatus: getRagStatus(totalScore),
    totalControls: controls.length,
    passingControls: passing,
    failingControls: failing,
    needsAttentionControls: needsAttention,
    notApplicableControls: notApplicable,
    overdueTasksCount: overdueTasks.length,
    upcomingTasksCount: upcomingTasks.length,
    openHighRisks: highRisks,
    openCriticalRisks: criticalRisks,
    failingTestsCount: failingTests,
  };
}

import type {
  DrataControl,
  DrataFramework,
  DrataTask,
  DrataRisk,
  FrameworkHealth,
} from "./types";
import { getControlStatus, getRiskSeverity, nameToSlug } from "./types";

export function calculateFrameworkHealth(
  controls: DrataControl[],
  framework: DrataFramework
): FrameworkHealth {
  // v2 controls carry frameworkTags: string[] — match by framework name
  const frameworkControls = controls.filter((c) =>
    c.frameworkTags?.some(
      (tag) => tag.toLowerCase() === framework.name.toLowerCase()
    )
  );

  const active = frameworkControls.filter((c) => !c.archivedAt);
  const passing = active.filter((c) => getControlStatus(c) === "PASSING").length;
  const failing = active.filter((c) => getControlStatus(c) === "FAILING").length;
  const needsAttention = active.filter(
    (c) => getControlStatus(c) === "NEEDS_ATTENTION"
  ).length;
  // Score denominator: only monitored controls (failing + passing)
  const monitored = passing + failing;
  const score = monitored > 0 ? Math.round((passing / monitored) * 100) : 0;

  return {
    id: framework.id,
    name: framework.name,
    slug: nameToSlug(framework.name),
    passingCount: passing,
    failingCount: failing,
    needsAttentionCount: needsAttention,
    totalCount: active.length,
    score,
  };
}

export function calculateOverallScore(frameworks: FrameworkHealth[]): number {
  const relevant = frameworks.filter((f) => f.passingCount + f.failingCount > 0);
  if (!relevant.length) return 0;
  const totalWeight = relevant.reduce((s, f) => s + f.passingCount + f.failingCount, 0);
  const weighted = relevant.reduce((s, f) => s + f.score * (f.passingCount + f.failingCount), 0);
  return totalWeight > 0 ? Math.round(weighted / totalWeight) : 0;
}

export function getRagStatus(score: number): "green" | "amber" | "red" {
  if (score >= 90) return "green";
  if (score >= 70) return "amber";
  return "red";
}

const TERMINAL_TASK_STATUSES = new Set(["COMPLETED"]);

export function getOverdueTasks(tasks: DrataTask[]): DrataTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return tasks.filter((t) => {
    if (TERMINAL_TASK_STATUSES.has(t.status ?? "")) return false;
    // v2 marks overdue tasks with PAST_DUE status, but also check date
    if (t.status === "PAST_DUE") return true;
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < today;
  });
}

export function getUpcomingTasks(tasks: DrataTask[]): DrataTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30 = new Date(today);
  in30.setDate(today.getDate() + 30);
  return tasks.filter((t) => {
    if (TERMINAL_TASK_STATUSES.has(t.status ?? "")) return false;
    if (t.status === "PAST_DUE") return false;
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate);
    return due >= today && due <= in30;
  });
}

export function countOpenRisksBySeverity(
  risks: DrataRisk[]
): { high: number; critical: number } {
  const CLOSED = new Set(["CLOSED", "ARCHIVED"]);
  const open = risks.filter((r) => !CLOSED.has(r.status ?? ""));
  return {
    high: open.filter((r) => getRiskSeverity(r) === "HIGH").length,
    critical: open.filter((r) => getRiskSeverity(r) === "CRITICAL").length,
  };
}

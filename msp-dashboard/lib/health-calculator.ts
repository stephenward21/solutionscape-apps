import type {
  DrataControl,
  DrataFramework,
  DrataTask,
  DrataRisk,
  FrameworkHealth,
} from "./types";

export function calculateFrameworkHealth(
  controls: DrataControl[],
  framework: DrataFramework
): FrameworkHealth {
  const frameworkControls = controls.filter(
    (c) => c.frameworkSlug === framework.slug
  );

  const passing = frameworkControls.filter((c) => c.status === "PASSING").length;
  const failing = frameworkControls.filter((c) => c.status === "FAILING").length;
  const needsAttention = frameworkControls.filter(
    (c) => c.status === "NEEDS_ATTENTION"
  ).length;
  const total = frameworkControls.filter(
    (c) => c.status !== "NOT_APPLICABLE"
  ).length;

  const score = total > 0 ? Math.round((passing / total) * 100) : 0;

  return {
    id: framework.id,
    name: framework.name,
    slug: framework.slug,
    passingCount: passing,
    failingCount: failing,
    needsAttentionCount: needsAttention,
    totalCount: total,
    score,
  };
}

export function calculateOverallScore(frameworks: FrameworkHealth[]): number {
  const relevant = frameworks.filter((f) => f.totalCount > 0);
  if (relevant.length === 0) return 0;

  const totalWeight = relevant.reduce((sum, f) => sum + f.totalCount, 0);
  const weightedSum = relevant.reduce(
    (sum, f) => sum + f.score * f.totalCount,
    0
  );

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function getRagStatus(score: number): "green" | "amber" | "red" {
  if (score >= 90) return "green";
  if (score >= 70) return "amber";
  return "red";
}

const TERMINAL_TASK_STATUSES = new Set(["COMPLETE", "DISMISSED"]);

export function getOverdueTasks(tasks: DrataTask[]): DrataTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (TERMINAL_TASK_STATUSES.has(t.status)) return false;
    const due = new Date(t.dueDate);
    return due < today;
  });
}

export function getUpcomingTasks(tasks: DrataTask[]): DrataTask[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(today.getDate() + 30);

  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (TERMINAL_TASK_STATUSES.has(t.status)) return false;
    const due = new Date(t.dueDate);
    return due >= today && due <= in30Days;
  });
}

export function countOpenRisksBySeverity(
  risks: DrataRisk[]
): { high: number; critical: number } {
  const CLOSED_STATUSES = new Set(["CLOSED", "ACCEPTED"]);
  const openRisks = risks.filter((r) => !CLOSED_STATUSES.has(r.status));

  return {
    high: openRisks.filter((r) => r.severity === "HIGH").length,
    critical: openRisks.filter((r) => r.severity === "CRITICAL").length,
  };
}

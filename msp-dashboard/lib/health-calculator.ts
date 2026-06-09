import type {
  DrataFramework,
  DrataTask,
  DrataRisk,
  FrameworkHealth,
} from "./types";
import { getRiskSeverity, nameToSlug } from "./types";

export function calculateFrameworkHealth(framework: DrataFramework): FrameworkHealth {
  const total = framework.numInScopeRequirements ?? 0;
  const passing = framework.numReadyInScopeRequirements ?? 0;
  const failing = total - passing;
  const score = total > 0 ? Math.round((passing / total) * 100) : 0;

  return {
    id: framework.id,
    name: framework.name,
    slug: framework.slug ?? nameToSlug(framework.name),
    passingCount: passing,
    failingCount: failing,
    needsAttentionCount: 0, // not derivable from framework-level fields
    totalCount: total,
    score,
  };
}

export function calculateOverallScore(frameworks: FrameworkHealth[]): number {
  const relevant = frameworks.filter((f) => f.totalCount > 0);
  if (!relevant.length) return 0;
  const totalWeight = relevant.reduce((s, f) => s + f.totalCount, 0);
  const weighted = relevant.reduce((s, f) => s + f.score * f.totalCount, 0);
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

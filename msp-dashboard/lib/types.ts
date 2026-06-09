// ─── Config ──────────────────────────────────────────────────────────────────

export interface Workspace {
  name: string;
  apiKey: string;
}

// ─── Drata v2 API shapes ─────────────────────────────────────────────────────

export interface DrataFramework {
  id: number;
  name: string;
  status?: string;
  // slug is not returned by v2 API — derive with nameToSlug()
}

export interface DrataControl {
  id: number;
  name: string;
  code?: string;
  description?: string;
  // v2 uses boolean flags instead of a status string
  isMonitored?: boolean;
  hasEvidence?: boolean;
  hasOwner?: boolean;
  isReady?: boolean;        // true = effectively "passing"
  hasPassingTest?: boolean;
  frameworkTags?: string[]; // e.g. ["SOC 2", "ISO 27001:2022"]
  archivedAt?: string | null;
  owners?: Array<{ id: number; firstName?: string; lastName?: string; email?: string }>;
}

export interface DrataTask {
  id: number;
  title: string;           // v2 uses "title", not "name"
  description?: string;
  status?: string;         // PAST_DUE | COMPLETED | INCOMPLETE
  taskType?: string;
  dueDate?: string;
  completedAt?: string | null;
  assignee?: { id: number; firstName?: string; lastName?: string; email?: string };
  controls?: Array<{ id: number; name: string; code: string }>;
}

export interface DrataRisk {
  id: number;
  title?: string;          // v2 uses "title", not "name"
  description?: string;
  status?: string;         // ACTIVE | ARCHIVED | CLOSED
  treatmentPlan?: string;  // UNTREATED | ACCEPT | TRANSFER | AVOID | MITIGATE
  impact?: number;         // 1–5
  likelihood?: number;     // 1–5
  score?: number;          // impact × likelihood (1–25)
  residualScore?: number;
}

export interface DrataEvent {
  id: number;
  action?: string;
  description?: string;
  createdAt: string;
  actor?: { name?: string; email?: string };
}

export interface DrataMonitoringTest {
  id: number;
  name?: string;
  checkResultStatus?: string; // READY | PASSED | FAILED | ERROR | PREAUDIT
  checkStatus?: string;       // UNUSED | NEW | ENABLED | DISABLED | TESTING
  controls?: Array<{ id: number; name: string; code: string }>;
}

// ─── Derived / computed types ─────────────────────────────────────────────────

/** Canonical status derived from v2 boolean flags */
export type ControlStatus = "PASSING" | "FAILING" | "NEEDS_ATTENTION" | "NOT_APPLICABLE";

export function getControlStatus(control: DrataControl): ControlStatus {
  if (control.archivedAt) return "NOT_APPLICABLE";
  if (control.isReady) return "PASSING";
  if (control.isMonitored) return "FAILING";
  return "NEEDS_ATTENTION";
}

/** Severity tier derived from numeric risk score (1–25) */
export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function getRiskSeverity(risk: DrataRisk): RiskSeverity {
  const score = risk.score ?? 0;
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

/** URL-safe slug derived from a framework name */
export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Dashboard types ──────────────────────────────────────────────────────────

export interface FrameworkHealth {
  id: number;
  name: string;
  slug: string;              // derived via nameToSlug()
  passingCount: number;
  failingCount: number;
  needsAttentionCount: number;
  totalCount: number;
  score: number;             // 0–100 % passing of monitored controls
}

export interface HistoryPoint {
  date: string;   // YYYY-MM-DD
  score: number;  // 0–100
}

export interface WorkspaceSnapshot {
  workspaceName: string;
  capturedAt: string;
  stale: boolean;
  frameworks: FrameworkHealth[];
  overallScore: number;
  ragStatus: "green" | "amber" | "red";
  totalControls: number;
  passingControls: number;
  failingControls: number;
  needsAttentionControls: number;
  overdueTasksCount: number;
  upcomingTasksCount: number;
  openHighRisks: number;
  openCriticalRisks: number;
  failingTestsCount: number;
  recentEvents: DrataEvent[];
  history: HistoryPoint[];
  error?: string;
}

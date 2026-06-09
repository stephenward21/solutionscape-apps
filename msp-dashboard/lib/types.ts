// ─── Config ──────────────────────────────────────────────────────────────────

export interface Workspace {
  name: string;
  apiKey: string;
}

// ─── Drata v2 API shapes ─────────────────────────────────────────────────────

export interface DrataWorkspace {
  id: number;
  name: string;
  primary?: boolean;
  description?: string;
}

export interface DrataFramework {
  id: number;
  name: string;
  slug?: string;
  tag?: string;
  isReady?: boolean;
  isEnabled?: boolean;
  numInScopeControls?: number;
  numInScopeRequirements?: number;
  numReadyInScopeRequirements?: number;
}

export interface DrataControlFlags {
  isReady?: string | boolean;   // API returns "true"/"false" string OR boolean
  isMonitored?: boolean;
  hasEvidence?: boolean;
  hasOwner?: boolean;
  hasPolicy?: boolean;
  hasTicket?: string | boolean; // API returns "true"/"false" string OR boolean
}

export interface DrataControl {
  id: number;
  name: string;
  code?: string;
  description?: string;
  flags?: DrataControlFlags;
  frameworkTags?: string[]; // e.g. ["SOC_2", "ISO_27001"]
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

/** Canonical status derived from v2 nested flags object */
export type ControlStatus = "PASSING" | "FAILING" | "NEEDS_ATTENTION" | "NOT_APPLICABLE";

function isTruthy(val: string | boolean | undefined): boolean {
  return val === true || val === "true";
}

export function getControlStatus(control: DrataControl): ControlStatus {
  if (control.archivedAt) return "NOT_APPLICABLE";
  if (isTruthy(control.flags?.isReady)) return "PASSING";
  if (control.flags?.isMonitored === true) return "FAILING";
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
  score: number;             // 0–100 % (numReadyInScopeRequirements / numInScopeRequirements)
}

export interface HistoryPoint {
  date: string;   // YYYY-MM-DD
  score: number;  // 0–100
}

export interface WorkspaceSnapshot {
  workspaceId: number;
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

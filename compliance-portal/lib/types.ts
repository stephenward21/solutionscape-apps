// ─── Drata API types (v2) ────────────────────────────────────────────────────

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
  isReady?: string | boolean; // API returns "true"/"false" STRING or boolean
  isMonitored?: boolean;
  hasEvidence?: boolean;
  hasOwner?: boolean;
  hasPolicy?: boolean;
  hasTicket?: string | boolean;
}

export interface DrataControl {
  id: number;
  name: string;
  code?: string;
  description?: string;
  flags?: DrataControlFlags;
  frameworkTags?: string[];
  archivedAt?: string | null;
  owners?: Array<{
    id: number;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
}

export interface DrataTask {
  id: number;
  title: string;
  status?: string; // PAST_DUE | COMPLETED | INCOMPLETE
  dueDate?: string;
  completedAt?: string | null;
  assignee?: {
    id: number;
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  controls?: Array<{ id: number; name: string; code: string }>;
}

export interface DrataRisk {
  id: number;
  title?: string;
  status?: string; // ACTIVE | ARCHIVED | CLOSED
  treatmentPlan?: string;
  impact?: number;
  likelihood?: number;
  score?: number;
}

export interface DrataMonitoringTest {
  id: number;
  name?: string;
  checkResultStatus?: string; // PASSED | FAILED | NOT_APPLICABLE
  lastCheckedAt?: string;
}

// ─── Derived helpers ──────────────────────────────────────────────────────────

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

export type RiskSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export function getRiskSeverity(risk: DrataRisk): RiskSeverity {
  const score = risk.score ?? 0;
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

// ─── Portal types ─────────────────────────────────────────────────────────────

/** Stored in data/portals/{token}.json — NEVER committed to git */
export interface PortalConfig {
  token: string;
  label: string;          // e.g. "Acme Corp"
  workspaceId: number;
  workspaceName: string;
  apiKey: string;
  createdAt: string;
  expiresAt?: string;     // ISO date; undefined = never expires
  showRisks: boolean;     // toggle sensitive risk data visibility
  showControls: boolean;
}

// ─── Snapshot / portal view ───────────────────────────────────────────────────

export interface FrameworkHealth {
  id: number;
  name: string;
  slug: string;
  passingCount: number;
  failingCount: number;
  totalCount: number;
  score: number; // 0–100
}

export interface PortalSnapshot {
  workspaceId: number;
  workspaceName: string;
  portalLabel: string;
  capturedAt: string;
  stale: boolean;
  error?: string;

  frameworks: FrameworkHealth[];
  overallScore: number;
  ragStatus: "green" | "amber" | "red";

  totalControls: number;
  passingControls: number;
  failingControls: number;
  needsAttentionControls: number;
  notApplicableControls: number;

  overdueTasksCount: number;
  upcomingTasksCount: number;

  openHighRisks: number;
  openCriticalRisks: number;

  failingTestsCount: number;
}

// ─── AI Priorities ────────────────────────────────────────────────────────────

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ActionItem {
  id: string;
  priority: Priority;
  category: "CONTROL" | "TASK" | "RISK" | "TEST";
  title: string;
  description: string;
  reasoning: string;
  suggestedAction: string;
  relatedIds?: string[];
}

export interface AIPrioritiesResult {
  generatedAt: string;
  workspaceId: number;
  items: ActionItem[];
  summary: string;
}

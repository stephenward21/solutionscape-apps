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
  /**
   * Populated when you use expand[]=evidenceIds on the controls endpoint.
   * Shape is an object whose values are arrays of evidence version IDs,
   * e.g. { documentIds: [1,2], imageIds: [3] }, or occasionally a flat number[].
   */
  evidenceIds?: Record<string, unknown> | number[];
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
  description?: string;
  checkResultStatus?: string; // PASSED | FAILED | ERROR | PREAUDIT | NA | READY
  checkStatus?: string;       // ENABLED | DISABLED | UNUSED | NEW | TESTING
  controls?: Array<{ id: number; name: string; code: string }>;
  /** When the test last ran */
  lastCheckedAt?: string;
  /** When the test first entered a failing/error state — null if currently passing */
  failingSince?: string;
  /** Integration or service being monitored (e.g. "AWS", "GitHub") */
  sourceName?: string;
  source?: string;
  /** Human-readable steps to remediate a failing test */
  remediationInstructions?: string;
  /** How often the test runs */
  frequency?: string;
  /** Severity tier assigned to the test */
  severity?: string;
}

// ─── Monitoring Tests AI types ────────────────────────────────────────────────

export interface TestPriorityItem {
  id: string;
  testId: number;
  testName: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  controlsAffected: Array<{ code: string; name: string }>;
  reasoning: string;
  failingSince?: string;
  suggestedAction: string;
  estimatedImpact: string;
}

export interface TestsAISummaryResult {
  generatedAt: string;
  workspaceId: number;
  overallHealthSummary: string;
  failingCount: number;
  errorCount: number;
  priorityItems: TestPriorityItem[];
}

export interface DrataEvidenceVersion {
  id: number;
  /** Direct download URL to the actual evidence file */
  source?: string;
  mimeType?: string;
  name?: string;
  createdAt?: string;
  size?: number;
}

export interface DrataEvidenceItem {
  id: number;
  name: string;
  description?: string;
  /** Controls this evidence is mapped to */
  controls?: Array<{ id: number; name: string; code: string }>;
  /** File versions (newest first when sorted by createdAt) — requires expand[]=versions */
  versions?: DrataEvidenceVersion[];
  archivedAt?: string | null;
  createdAt?: string;
}

/**
 * Response shape from GET /workspaces/{id}/evidence-library/versions/{versionId}
 * (EvidenceLibraryPublicV2Controller_getEvidenceLibraryVersion)
 */
export interface DrataEvidenceLibraryVersion {
  id: number;
  /** Presigned or direct download URL for the evidence file */
  downloadUrl?: string;
  mimeType?: string;
  name?: string;
  size?: number;
  createdAt?: string;
  /** Parent evidence library item ID */
  evidenceId?: number;
  evidenceName?: string;
}

// ─── AI Summary types ─────────────────────────────────────────────────────────

export type ActionPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ActionCategory = "CONTROL" | "TASK" | "RISK" | "TEST";

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  description: string;
  reasoning: string;
  suggestedAction: string;
  relatedIds?: string[];
}

export interface AISummaryResult {
  generatedAt: string;
  workspaceId: number;
  summary: string;
  items: ActionItem[];
}

// ─── Control Mapper types ─────────────────────────────────────────────────────

export interface RecommendedControlMapping {
  controlId: number;
  controlCode: string;
  controlName: string;
  frameworkTags: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  evidenceNote: string;
}

export interface ControlMappingFileResult {
  fileName: string;
  mimeType: string;
  size: number;
  fileDescription: string;
  recommendedControls: RecommendedControlMapping[];
  skipped?: boolean;
  skipReason?: string;
}

export interface ControlMappingResult {
  generatedAt: string;
  workspaceId: number;
  sourceUrl: string;
  totalFiles: number;
  analyzedCount: number;
  skippedCount: number;
  files: ControlMappingFileResult[];
}

// ─── Evidence validation types ────────────────────────────────────────────────

export type EvidenceAdequacy = "ADEQUATE" | "PARTIAL" | "INADEQUATE" | "UNRELATED";

export interface EvidenceControlValidation {
  controlId: number;
  controlCode: string;
  controlName: string;
  frameworkTags: string[];
  adequacy: EvidenceAdequacy;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  finding: string;
  gaps: string[];
  recommendation: string;
}

export interface EvidenceValidationItem {
  evidenceId: number;
  evidenceName: string;
  fileUrl: string;
  mimeType: string;
  fileDescription: string;
  controlValidations: EvidenceControlValidation[];
  /** true if we skipped this file (too large, unsupported type, download failed) */
  skipped?: boolean;
  skipReason?: string;
}

export interface EvidenceValidationResult {
  generatedAt: string;
  workspaceId: number;
  totalEvidenceItems: number;
  validatedCount: number;
  skippedCount: number;
  adequateCount: number;
  partialCount: number;
  inadequateCount: number;
  unrelatedCount: number;
  items: EvidenceValidationItem[];
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

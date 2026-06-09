// ─── Drata types (minimal subset needed) ─────────────────────────────────────

export interface DrataWorkspace { id: number; name: string; }

export interface DrataControlFlags {
  isReady?: string | boolean;
  isMonitored?: boolean;
  hasEvidence?: boolean;
  hasOwner?: boolean;
}

export interface DrataControl {
  id: number;
  name: string;
  code?: string;
  flags?: DrataControlFlags;
  frameworkTags?: string[];
  archivedAt?: string | null;
}

export interface DrataTask {
  id: number;
  title: string;
  status?: string;
  dueDate?: string;
  assignee?: { id: number; firstName?: string; lastName?: string; email?: string };
}

export interface DrataRisk {
  id: number;
  title?: string;
  status?: string;
  score?: number;
  treatmentPlan?: string;
}

export interface DrataMonitoringTest {
  id: number;
  name?: string;
  checkResultStatus?: string;
  lastCheckedAt?: string;
}

// ─── Alert Rule types ─────────────────────────────────────────────────────────

export type AlertTrigger =
  | "NEW_FAILING_CONTROL"     // a control transitions to FAILING
  | "NEW_OVERDUE_TASK"        // a task becomes past due
  | "CRITICAL_RISK_OPENED"    // a risk with score >= 20 enters ACTIVE status
  | "HIGH_RISK_OPENED"        // a risk with score >= 12 enters ACTIVE status
  | "FAILING_TEST"            // a monitoring test flips to FAILED
  | "CONTROL_NEEDS_OWNER"     // a control has no owner
  | "DAILY_DIGEST";           // daily summary regardless of changes

export type ChannelType = "SLACK" | "EMAIL" | "JIRA" | "WEBHOOK";

export interface SlackChannel {
  type: "SLACK";
  webhookUrl: string;
  /** Optional channel override, e.g. #compliance-alerts */
  channel?: string;
}

export interface EmailChannel {
  type: "EMAIL";
  /** SMTP is via environment variable config — this is just the recipient */
  to: string[];
  subject?: string;
}

export interface JiraChannel {
  type: "JIRA";
  baseUrl: string;       // e.g. https://mycompany.atlassian.net
  projectKey: string;    // e.g. COMP
  email: string;
  apiToken: string;
  issueType?: string;    // default: "Task"
  priority?: string;     // default: "High"
  labels?: string[];
}

export interface WebhookChannel {
  type: "WEBHOOK";
  url: string;
  /** Optional Bearer token */
  bearerToken?: string;
  /** Optional static headers */
  headers?: Record<string, string>;
}

export type AlertChannel = SlackChannel | EmailChannel | JiraChannel | WebhookChannel;

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  createdAt: string;
  /** Drata API key for this rule's workspace */
  drataApiKey: string;
  workspaceId: number;
  workspaceName: string;
  /** Which events trigger this rule */
  triggers: AlertTrigger[];
  /** Where to send alerts */
  channels: AlertChannel[];
  /** Minimum severity to alert (for risk triggers): CRITICAL | HIGH | MEDIUM | LOW */
  minRiskSeverity?: string;
  /** Last time this rule was evaluated */
  lastCheckedAt?: string;
}

// ─── Alert event / history ────────────────────────────────────────────────────

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";

export interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  workspaceName: string;
  trigger: AlertTrigger;
  severity: AlertSeverity;
  title: string;
  body: string;
  firedAt: string;
  channels: ChannelType[];
  deliveryStatus: Record<ChannelType, "SENT" | "FAILED" | "SKIPPED">;
  error?: string;
}

// ─── Check state (used to detect transitions) ────────────────────────────────

/** Snapshot of a workspace's state, keyed by item IDs, to detect changes */
export interface CheckState {
  workspaceId: number;
  capturedAt: string;
  failingControlIds: number[];
  overdueTaskIds: number[];
  activeRiskIds: number[];     // ACTIVE risks with score >= threshold
  failingTestIds: number[];
  noOwnerControlIds: number[];
}

// ─── Policy analysis ──────────────────────────────────────────────────────────

export interface PolicyFile {
  id: string;
  filename: string;
  uploadedAt: string;
  sizeBytes: number;
}

export interface AIToolPolicy {
  tool: string;           // e.g. "ChatGPT", "GitHub Copilot", "Midjourney"
  vendor: string;         // e.g. "OpenAI", "GitHub", "Midjourney Inc."
  status: "APPROVED" | "PROHIBITED" | "CONDITIONAL" | "UNREVIEWED";
  conditions?: string;    // e.g. "Approved only for non-sensitive data"
  categories?: string[];  // e.g. ["code-generation", "llm", "image-generation"]
  reasoning: string;      // Claude's explanation for the classification
}

export interface PolicyAnalysisResult {
  id: string;
  policyFilename: string;
  analyzedAt: string;
  organizationName?: string;
  summary: string;
  approvedTools: AIToolPolicy[];
  prohibitedTools: AIToolPolicy[];
  conditionalTools: AIToolPolicy[];
  unreviewedCategories: string[];  // categories the policy doesn't address
  policyGaps: string[];            // things Claude flagged as missing
}

// ─── IdP / directory integration ─────────────────────────────────────────────

export type IdPProvider = "google" | "microsoft" | "okta" | "manual";

export interface IdPConnection {
  provider: IdPProvider;
  label: string;       // e.g. "Acme Corp — Google Workspace"
  connectedAt: string;
  lastSyncAt?: string;
  userCount?: number;
}

export interface UserActivity {
  userId: string;
  email: string;
  displayName?: string;
  department?: string;
  aiToolsDetected: DetectedAITool[];
  lastActivityAt?: string;
}

export interface DetectedAITool {
  tool: string;               // matched tool name
  vendor: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  signInCount?: number;
  oauthScopes?: string[];     // what permissions the tool requested
  systemsAccessed?: string[]; // e.g. ["Google Drive", "Gmail", "GitHub"]
  detectionMethod: "oauth" | "saml" | "audit-log" | "manual";
  // false when the app name didn't match our known AI-tool signature list —
  // it's a real OAuth grant, just not yet identified as a specific product.
  // Surfaced for review instead of being silently dropped.
  recognized?: boolean;
}

// ─── Compliance / breach analysis ────────────────────────────────────────────

export type ComplianceStatus = "COMPLIANT" | "BREACH" | "CONDITIONAL" | "UNKNOWN";

export interface UserComplianceRecord {
  userId: string;
  email: string;
  displayName?: string;
  department?: string;
  complianceStatus: ComplianceStatus;
  breachingTools: BreachDetail[];
  conditionalTools: BreachDetail[];
  approvedTools: DetectedAITool[];
  riskScore: number;  // 0–100
  needsReview?: { tool: string; reason: string }[]; // unrecognized apps Claude couldn't confidently classify
}

export interface BreachDetail {
  tool: string;
  vendor: string;
  policyStatus: AIToolPolicy["status"];
  reason: string;                 // why it's a breach
  systemsAccessed?: string[];
  recommendation: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface GovernanceReport {
  id: string;
  generatedAt: string;
  organizationName?: string;
  policyId?: string;

  totalUsers: number;
  compliantUsers: number;
  breachingUsers: number;
  conditionalUsers: number;
  unknownUsers: number;

  totalAIToolsDetected: number;
  prohibitedToolsInUse: string[];   // tool names actively being used in breach
  toolsNeedingReview: number;       // unrecognized apps flagged across all users for manual review
  topRiskUsers: UserComplianceRecord[];

  aiNarrative: string;              // Claude executive summary
  userRecords: UserComplianceRecord[];
}

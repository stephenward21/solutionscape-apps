// ─── Drata API types (v2) ────────────────────────────────────────────────────

export interface DrataWorkspace {
  id: number;
  name: string;
  primary?: boolean;
}

export interface DrataFramework {
  id: number;
  name: string;
  slug?: string;
  numInScopeRequirements?: number;
  numReadyInScopeRequirements?: number;
}

export interface DrataControlFlags {
  isReady?: string | boolean;
  isMonitored?: boolean;
  hasEvidence?: boolean;
  hasOwner?: boolean;
  hasPolicy?: boolean;
}

export interface DrataControl {
  id: number;
  name: string;
  code?: string;
  description?: string;
  flags?: DrataControlFlags;
  frameworkTags?: string[];
  archivedAt?: string | null;
}

// ─── File + Validation types ─────────────────────────────────────────────────

export type SupportedMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "application/pdf";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  /** base64-encoded file content */
  base64: string;
}

/** A file mapped to one or more controls for validation */
export interface FileMapping {
  fileId: string;
  controlIds: number[];
  /** Optional user note about what this file demonstrates */
  note?: string;
}

// ─── Validation result types ──────────────────────────────────────────────────

export type Adequacy = "ADEQUATE" | "PARTIAL" | "INADEQUATE" | "UNRELATED";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ControlValidation {
  controlId: number;
  controlCode: string;
  controlName: string;
  frameworkTags: string[];
  adequacy: Adequacy;
  confidence: Confidence;
  /** What the evidence demonstrates relative to this control */
  finding: string;
  /** Specific gaps or issues found */
  gaps: string[];
  /** Concrete recommendation for closing gaps */
  recommendation: string;
}

export interface FileValidationResult {
  fileId: string;
  fileName: string;
  /** What Claude understood this file to be / contain */
  fileDescription: string;
  controlValidations: ControlValidation[];
}

// ─── Report types ─────────────────────────────────────────────────────────────

export type ReportStatus = "AUDIT_READY" | "NEEDS_WORK" | "NOT_READY";

export interface ControlGapSummary {
  controlId: number;
  controlCode: string;
  controlName: string;
  frameworkTags: string[];
  /** Best adequacy across all files mapped to this control */
  bestAdequacy: Adequacy;
  mappedFileCount: number;
  gaps: string[];
}

export interface ValidationReport {
  id: string;
  createdAt: string;
  workspaceId: number;
  workspaceName: string;
  fileResults: FileValidationResult[];
  controlGaps: ControlGapSummary[];
  /** Controls with evidence mapped to them */
  coveredControlCount: number;
  /** Controls in scope but not mapped to any evidence */
  uncoveredControlCount: number;
  totalInScopeControls: number;
  overallStatus: ReportStatus;
  executiveSummary: string;
}

// ─── API request/response ─────────────────────────────────────────────────────

export interface ValidateRequest {
  apiKey: string;
  workspaceId: number;
  workspaceName: string;
  files: UploadedFile[];
  mappings: FileMapping[];
  /** All in-scope controls (fetched client-side from Drata) */
  controls: DrataControl[];
}

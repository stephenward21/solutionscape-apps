export interface Workspace {
  name: string;
  apiKey: string;
}

export interface DrataFramework {
  id: number;
  name: string;
  status?: string;
  // slug is not returned by the v2 API — derive with nameToSlug()
}

export interface DrataControl {
  id: number;
  name: string;
  description?: string;
  code?: string;
  // v2 uses boolean flags instead of a status string
  isMonitored?: boolean;
  hasEvidence?: boolean;
  isReady?: boolean;
  hasPassingTest?: boolean;
  frameworkTags?: string[]; // e.g. ["SOC 2", "ISO 27001:2022"]
  archivedAt?: string | null;
  owners?: Array<{ id: number; firstName?: string; lastName?: string; email?: string }>;
}

export type ControlStatus = "PASSING" | "FAILING" | "NEEDS_ATTENTION" | "NOT_APPLICABLE";

export function getControlStatus(control: DrataControl): ControlStatus {
  if (control.archivedAt) return "NOT_APPLICABLE";
  if (control.isReady) return "PASSING";
  if (control.isMonitored) return "FAILING";
  return "NEEDS_ATTENTION";
}

export function nameToSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export interface DrataEvidence {
  id: number;
  fileName: string;
  description: string;
  collectedAt: string;
  uploadedAt: string;
  controlId: number;
  controlName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface SyncLogEntry {
  id: string;
  workspaceName: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  controlId: number;
  controlName: string;
  controlCode: string;
  description: string;
  collectedAt: string;
  uploadedAt: string;
  status: "success" | "error" | "skipped";
  errorMessage?: string;
  drataEvidenceId?: number;
  fileHash: string;
}

export interface BulkMapping {
  fileName: string;
  controlId: number;
  description?: string;
  collectedAt?: string;
}

export interface UploadProgress {
  fileName: string;
  status: "pending" | "uploading" | "done" | "error" | "skipped";
  error?: string;
}

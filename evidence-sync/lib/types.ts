export interface Workspace {
  name: string;
  apiKey: string;
}

export interface DrataFramework {
  id: number;
  name: string;
  slug: string; // e.g. "soc2", "iso27001", "hipaa"
}

export interface DrataControl {
  id: number;
  name: string;
  description: string;
  code: string; // e.g. "CC6.1"
  frameworkSlug: string;
  status: "PASSING" | "FAILING" | "NEEDS_ATTENTION" | "NOT_APPLICABLE";
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

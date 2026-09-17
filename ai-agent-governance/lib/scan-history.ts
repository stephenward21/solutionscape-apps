/**
 * localStorage-backed scan history for web (non-Electron) contexts.
 * Mirrors the shape of the Electron db ReportSummary so MetricsPanel
 * can use the same code path regardless of runtime.
 */

import type { BasicAIReport } from "./types";

const STORAGE_KEY = "ss:scan-history";
const MAX_REPORTS = 50; // cap to avoid blowing localStorage

export interface StoredReportSummary {
  id: string;
  generatedAt: string;
  totalUsers: number;
  totalTools: number;
  criticalTools: number;
  highRiskTools: number;
}

export interface StoredReport extends StoredReportSummary {
  full: BasicAIReport;
}

function readAll(): StoredReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredReport[];
  } catch {
    return [];
  }
}

function writeAll(reports: StoredReport[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // Quota exceeded — drop oldest and retry once
    try {
      const trimmed = reports.slice(0, Math.floor(reports.length / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch { /* give up */ }
  }
}

/** Save a completed scan report. Returns the stored entry. */
export function saveScanReport(report: BasicAIReport): StoredReport {
  const existing = readAll();
  const entry: StoredReport = {
    id:            report.id,
    generatedAt:   report.generatedAt,
    totalUsers:    report.totalUsersScanned,
    totalTools:    report.totalAIToolsFound,
    criticalTools: report.criticalTools,
    highRiskTools: report.highRiskTools,
    full:          report,
  };
  // Newest first, deduplicate by id
  const updated = [entry, ...existing.filter((r) => r.id !== report.id)].slice(0, MAX_REPORTS);
  writeAll(updated);
  return entry;
}

/** List summaries, newest first (matches Electron db.reports.list shape). */
export function listScanSummaries(): StoredReportSummary[] {
  return readAll().map(({ full: _, ...summary }) => summary);
}

/** Get a full report by id. */
export function getScanReport(id: string): BasicAIReport | null {
  return readAll().find((r) => r.id === id)?.full ?? null;
}

/** Delete all stored reports. */
export function clearScanHistory() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

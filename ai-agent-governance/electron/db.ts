import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";
import type { BasicAIReport } from "../lib/types";

let db: Database.Database;

export function initDb(): void {
  const dbPath = path.join(app.getPath("userData"), "governance.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS scan_reports (
      id           TEXT PRIMARY KEY,
      generated_at TEXT NOT NULL,
      total_users  INTEGER NOT NULL DEFAULT 0,
      total_tools  INTEGER NOT NULL DEFAULT 0,
      critical_tools INTEGER NOT NULL DEFAULT 0,
      high_risk    INTEGER NOT NULL DEFAULT 0,
      report_json  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_config (
      id           INTEGER PRIMARY KEY CHECK (id = 1),
      enabled      INTEGER NOT NULL DEFAULT 0,
      cron_expr    TEXT    NOT NULL DEFAULT '0 9 * * 1',
      last_run_at  TEXT,
      next_run_at  TEXT
    );

    INSERT OR IGNORE INTO schedule_config (id, enabled, cron_expr)
    VALUES (1, 0, '0 9 * * 1');
  `);
}

// ─── Report history ───────────────────────────────────────────────────────────

export interface ReportSummary {
  id: string;
  generatedAt: string;
  totalUsers: number;
  totalTools: number;
  criticalTools: number;
  highRiskTools: number;
}

export function saveReport(report: BasicAIReport): void {
  db.prepare(`
    INSERT OR REPLACE INTO scan_reports
    (id, generated_at, total_users, total_tools, critical_tools, high_risk, report_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id,
    report.generatedAt,
    report.totalUsersScanned,
    report.totalAIToolsFound,
    report.criticalTools,
    report.highRiskTools,
    JSON.stringify(report),
  );
}

export function listReports(): ReportSummary[] {
  return db.prepare(`
    SELECT id,
           generated_at  AS generatedAt,
           total_users   AS totalUsers,
           total_tools   AS totalTools,
           critical_tools AS criticalTools,
           high_risk     AS highRiskTools
    FROM scan_reports
    ORDER BY generated_at DESC
    LIMIT 100
  `).all() as ReportSummary[];
}

export function getReport(id: string): BasicAIReport | null {
  const row = db
    .prepare("SELECT report_json FROM scan_reports WHERE id = ?")
    .get(id) as { report_json: string } | undefined;
  return row ? (JSON.parse(row.report_json) as BasicAIReport) : null;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────

export interface ScheduleConfig {
  enabled: boolean;
  cronExpr: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export function getScheduleConfig(): ScheduleConfig {
  const row = db
    .prepare("SELECT enabled, cron_expr, last_run_at, next_run_at FROM schedule_config WHERE id = 1")
    .get() as { enabled: number; cron_expr: string; last_run_at: string | null; next_run_at: string | null };
  return {
    enabled: row.enabled === 1,
    cronExpr: row.cron_expr,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  };
}

export function setScheduleConfig(config: { enabled: boolean; cronExpr: string }): void {
  db.prepare(`
    UPDATE schedule_config SET enabled = ?, cron_expr = ? WHERE id = 1
  `).run(config.enabled ? 1 : 0, config.cronExpr);
}

export function recordRun(lastRunAt: string, nextRunAt: string | null): void {
  db.prepare("UPDATE schedule_config SET last_run_at = ?, next_run_at = ? WHERE id = 1")
    .run(lastRunAt, nextRunAt);
}

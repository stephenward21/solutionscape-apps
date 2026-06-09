import fs from "fs";
import path from "path";
import type { ValidationReport } from "./types";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

function ensureDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

export function saveReport(report: ValidationReport): void {
  ensureDir();
  fs.writeFileSync(
    path.join(REPORTS_DIR, `${report.id}.json`),
    JSON.stringify(report, null, 2),
    "utf8"
  );
}

export function loadReport(id: string): ValidationReport | null {
  ensureDir();
  const file = path.join(REPORTS_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ValidationReport;
  } catch {
    return null;
  }
}

export function listReports(): ValidationReport[] {
  ensureDir();
  return fs
    .readdirSync(REPORTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(REPORTS_DIR, f), "utf8")
        ) as ValidationReport;
      } catch {
        return null;
      }
    })
    .filter((r): r is ValidationReport => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

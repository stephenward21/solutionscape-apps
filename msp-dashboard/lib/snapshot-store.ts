import fs from "fs";
import path from "path";
import type { WorkspaceSnapshot, HistoryPoint } from "./types";

const SNAPSHOTS_DIR = path.join(process.cwd(), "data", "snapshots");

function ensureDir(): void {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  }
}

function snapshotPath(workspaceId: number): string {
  return path.join(SNAPSHOTS_DIR, `${workspaceId}.json`);
}

export function saveSnapshot(snapshot: WorkspaceSnapshot): void {
  ensureDir();
  const filePath = snapshotPath(snapshot.workspaceId);

  // Load existing history before overwriting
  const existing = loadSnapshot(snapshot.workspaceId);
  const existingHistory: HistoryPoint[] = existing?.history ?? [];

  // Append today's score point (deduplicate by date)
  const todayDate = new Date().toISOString().split("T")[0] ?? "";
  const filtered = existingHistory.filter((p) => p.date !== todayDate);
  const newHistory: HistoryPoint[] = [
    ...filtered,
    { date: todayDate, score: snapshot.overallScore },
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  const toSave: WorkspaceSnapshot = {
    ...snapshot,
    history: newHistory,
  };

  fs.writeFileSync(filePath, JSON.stringify(toSave, null, 2), "utf-8");
}

export function loadSnapshot(workspaceId: number): WorkspaceSnapshot | null {
  const filePath = snapshotPath(workspaceId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as WorkspaceSnapshot;
  } catch {
    return null;
  }
}

export function isStale(
  snapshot: WorkspaceSnapshot,
  maxAgeMinutes = 15
): boolean {
  const capturedAt = new Date(snapshot.capturedAt).getTime();
  const ageMs = Date.now() - capturedAt;
  return ageMs > maxAgeMinutes * 60 * 1000;
}

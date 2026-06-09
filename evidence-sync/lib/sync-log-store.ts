import fs from "fs";
import path from "path";
import type { SyncLogEntry } from "./types";

const LOG_DIR = path.join(process.cwd(), "data", "sync-logs");

function ensureDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function appendSyncLog(entry: SyncLogEntry): void {
  ensureDir();
  const filePath = path.join(LOG_DIR, `${entry.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
}

export function listSyncLog(): SyncLogEntry[] {
  ensureDir();
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".json"));

  const entries: SyncLogEntry[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(LOG_DIR, file), "utf-8");
      const parsed = JSON.parse(content) as SyncLogEntry;
      entries.push(parsed);
    } catch {
      // skip corrupt entries
    }
  }

  // Sort newest first by uploadedAt
  entries.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  return entries.slice(0, 200);
}

export function clearSyncLog(): void {
  ensureDir();
  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    fs.unlinkSync(path.join(LOG_DIR, file));
  }
}

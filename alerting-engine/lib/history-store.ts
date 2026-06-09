import fs from "fs";
import path from "path";
import type { AlertEvent } from "./types";

const HISTORY_FILE = path.join(process.cwd(), "data", "history", "events.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
}

export function appendEvent(event: AlertEvent): void {
  ensureDir();
  const existing = loadEvents();
  // Keep last 500 events
  const trimmed = [event, ...existing].slice(0, 500);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf8");
}

export function loadEvents(limit = 100): AlertEvent[] {
  ensureDir();
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const all = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8")) as AlertEvent[];
    return all.slice(0, limit);
  } catch {
    return [];
  }
}

import fs from "fs";
import path from "path";
import type { AlertRule, CheckState } from "./types";

const RULES_DIR = path.join(process.cwd(), "data", "rules");
const STATE_DIR = path.join(process.cwd(), "data", "history");

const ensureDir = (d: string) => fs.mkdirSync(d, { recursive: true });

// ─── Rules ────────────────────────────────────────────────────────────────────

export function saveRule(rule: AlertRule): void {
  ensureDir(RULES_DIR);
  fs.writeFileSync(path.join(RULES_DIR, `${rule.id}.json`), JSON.stringify(rule, null, 2), "utf8");
}

export function loadRule(id: string): AlertRule | null {
  const file = path.join(RULES_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as AlertRule; } catch { return null; }
}

export function deleteRule(id: string): void {
  const file = path.join(RULES_DIR, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function listRules(): AlertRule[] {
  ensureDir(RULES_DIR);
  return fs.readdirSync(RULES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(RULES_DIR, f), "utf8")) as AlertRule; } catch { return null; } })
    .filter((r): r is AlertRule => r !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function updateRuleLastChecked(id: string): void {
  const rule = loadRule(id);
  if (rule) { rule.lastCheckedAt = new Date().toISOString(); saveRule(rule); }
}

// ─── Check state (transition detection) ──────────────────────────────────────

export function loadCheckState(workspaceId: number): CheckState | null {
  ensureDir(STATE_DIR);
  const file = path.join(STATE_DIR, `state-${workspaceId}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")) as CheckState; } catch { return null; }
}

export function saveCheckState(state: CheckState): void {
  ensureDir(STATE_DIR);
  fs.writeFileSync(
    path.join(STATE_DIR, `state-${state.workspaceId}.json`),
    JSON.stringify(state, null, 2),
    "utf8"
  );
}

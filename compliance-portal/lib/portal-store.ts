/**
 * Portal store — persists PortalConfig objects as JSON files under
 * data/portals/{token}.json.  The whole data/portals/ directory is gitignored
 * so API keys are never committed.
 */
import fs from "fs";
import path from "path";
import type { PortalConfig } from "./types";

const PORTALS_DIR = path.join(process.cwd(), "data", "portals");

function ensureDir() {
  fs.mkdirSync(PORTALS_DIR, { recursive: true });
}

export function savePortal(config: PortalConfig): void {
  ensureDir();
  const filePath = path.join(PORTALS_DIR, `${config.token}.json`);
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf8");
}

export function loadPortal(token: string): PortalConfig | null {
  ensureDir();
  const filePath = path.join(PORTALS_DIR, `${token}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as PortalConfig;
  } catch {
    return null;
  }
}

export function deletePortal(token: string): void {
  ensureDir();
  const filePath = path.join(PORTALS_DIR, `${token}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function listPortals(): PortalConfig[] {
  ensureDir();
  return fs
    .readdirSync(PORTALS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(
          fs.readFileSync(path.join(PORTALS_DIR, f), "utf8")
        ) as PortalConfig;
      } catch {
        return null;
      }
    })
    .filter((c): c is PortalConfig => c !== null);
}

/** Returns null if token doesn't exist OR has expired */
export function getValidPortal(token: string): PortalConfig | null {
  const config = loadPortal(token);
  if (!config) return null;
  if (config.expiresAt && new Date(config.expiresAt) < new Date()) return null;
  return config;
}

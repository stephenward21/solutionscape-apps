/**
 * Module-level workspace cache so individual API route calls don't re-fetch
 * the workspace list from Drata on every request during the same process lifetime.
 */

import type { DrataWorkspace } from "./types";
import { getTenants, getClientForKey } from "./drata-client";

export interface WorkspaceEntry {
  id: number;
  name: string;
  primary: boolean;
  apiKey: string;
  apiKeyLabel: string;
}

let cachedEntries: WorkspaceEntry[] | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function listWorkspaceEntries(): Promise<WorkspaceEntry[]> {
  if (cachedEntries && Date.now() < cacheExpiresAt) {
    return cachedEntries;
  }

  const tenants = getTenants();
  const results: WorkspaceEntry[] = [];
  const multiTenant = tenants.length > 1;

  for (const tenant of tenants) {
    const client = getClientForKey(tenant.apiKey);
    const workspaces: DrataWorkspace[] = await client.listWorkspaces();
    for (const ws of workspaces) {
      results.push({
        id: ws.id,
        // Prefix with tenant label when there are multiple tenants
        name: multiTenant ? `${tenant.name} — ${ws.name}` : ws.name,
        primary: ws.primary ?? false,
        apiKey: tenant.apiKey,
        apiKeyLabel: tenant.name,
      });
    }
  }

  cachedEntries = results;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return results;
}

/** Find an entry by workspace ID */
export async function getWorkspaceEntry(workspaceId: number): Promise<WorkspaceEntry | null> {
  const entries = await listWorkspaceEntries();
  return entries.find((e) => e.id === workspaceId) ?? null;
}

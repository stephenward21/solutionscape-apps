import type {
  DrataFramework,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
  DrataEvent,
  Workspace,
} from "./types";

const BASE_URL = "https://public-api.drata.com/public/v2";

interface CursorResponse<T> {
  data: T[];
  pagination?: { cursor?: string | null; totalCount?: number };
}

export class DrataClient {
  private readonly apiKey: string;
  private cachedWorkspaceId?: number;
  private cachedRiskRegisterId?: number;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Drata API error ${res.status} for ${path}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  /** Fetch all pages of a cursor-paginated endpoint. */
  private async fetchAll<T>(path: string, max = 1000): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null | undefined = undefined;
    do {
      const params: Record<string, string | number | boolean | undefined> = {
        size: 100,
        includeTotalCount: true,
        ...(cursor ? { cursor } : {}),
      };
      const result = await this.request<CursorResponse<T>>(path, params);
      const page = result.data ?? [];
      items.push(...page);
      cursor = result.pagination?.cursor ?? null;
    } while (cursor && items.length < max);
    return items;
  }

  private async resolveWorkspaceId(): Promise<number> {
    if (this.cachedWorkspaceId) return this.cachedWorkspaceId;
    const result = await this.request<CursorResponse<{ id: number; primary?: boolean }>>(
      "/workspaces",
      { size: 50, includeTotalCount: true }
    );
    const workspaces = result.data ?? [];
    if (!workspaces.length) throw new Error("No workspaces found in this account");
    const primary = workspaces.find((w) => w.primary) ?? workspaces[0];
    if (!primary) throw new Error("No workspaces found in this account");
    this.cachedWorkspaceId = primary.id;
    return this.cachedWorkspaceId;
  }

  private async resolveRiskRegisterId(): Promise<number> {
    if (this.cachedRiskRegisterId) return this.cachedRiskRegisterId;
    const result = await this.request<CursorResponse<{ id: number }>>(
      "/risk-registers",
      { size: 1, includeTotalCount: true }
    );
    const registers = result.data ?? [];
    if (!registers.length) throw new Error("No risk registers found");
    const first = registers[0];
    if (!first) throw new Error("No risk registers found");
    this.cachedRiskRegisterId = first.id;
    return this.cachedRiskRegisterId;
  }

  async getFrameworks(): Promise<DrataFramework[]> {
    const wsId = await this.resolveWorkspaceId();
    return this.fetchAll<DrataFramework>(`/workspaces/${wsId}/frameworks`);
  }

  async getControls(): Promise<DrataControl[]> {
    const wsId = await this.resolveWorkspaceId();
    return this.fetchAll<DrataControl>(`/workspaces/${wsId}/controls`);
  }

  async getTasks(): Promise<DrataTask[]> {
    const wsId = await this.resolveWorkspaceId();
    return this.fetchAll<DrataTask>(`/workspaces/${wsId}/tasks`, 500);
  }

  async getRisks(): Promise<DrataRisk[]> {
    const regId = await this.resolveRiskRegisterId();
    return this.fetchAll<DrataRisk>(`/risk-registers/${regId}/risks`, 500);
  }

  async getMonitoringTests(): Promise<DrataMonitoringTest[]> {
    const wsId = await this.resolveWorkspaceId();
    return this.fetchAll<DrataMonitoringTest>(`/workspaces/${wsId}/monitoring-tests`, 500);
  }

  async getEvents(limit = 20): Promise<DrataEvent[]> {
    // Events endpoint may not be available in all plans — fall back gracefully
    try {
      const wsId = await this.resolveWorkspaceId();
      const result = await this.request<CursorResponse<DrataEvent>>(
        `/workspaces/${wsId}/events`,
        { size: limit }
      );
      return result.data ?? [];
    } catch {
      return [];
    }
  }
}

function getWorkspaces(): Workspace[] {
  const tenantsEnv = process.env.DRATA_TENANTS;
  if (tenantsEnv) {
    try {
      const parsed = JSON.parse(tenantsEnv) as Workspace[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      throw new Error("DRATA_TENANTS is not valid JSON");
    }
  }
  const singleKey = process.env.DRATA_API_KEY;
  if (singleKey) return [{ name: "Default", apiKey: singleKey }];
  return [];
}

export function getClient(workspaceName?: string): DrataClient {
  const workspaces = getWorkspaces();
  if (!workspaces.length) {
    throw new Error("No Drata credentials configured. Set DRATA_API_KEY or DRATA_TENANTS.");
  }
  if (!workspaceName || workspaceName === "Default") {
    return new DrataClient(workspaces[0]!.apiKey);
  }
  const ws = workspaces.find((w) => w.name.toLowerCase() === workspaceName.toLowerCase());
  if (!ws) throw new Error(`Workspace "${workspaceName}" not found in configuration`);
  return new DrataClient(ws.apiKey);
}

export function listWorkspaceNames(): string[] {
  return getWorkspaces().map((w) => w.name);
}

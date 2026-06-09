import type {
  DrataWorkspace,
  DrataFramework,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
  DrataEvent,
  DrataEvidenceItem,
  Workspace,
} from "./types";

const BASE_URL = "https://public-api.drata.com/public/v2";

interface CursorResponse<T> {
  data: T[];
  pagination?: { cursor?: string | null; totalCount?: number };
}

export class DrataClient {
  private readonly apiKey: string;
  private cachedRiskRegisterId?: number;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, searchParams?: URLSearchParams): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (searchParams) {
      searchParams.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
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
  private async fetchAll<T>(
    path: string,
    extraParams?: URLSearchParams,
    max = 1000
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null | undefined = undefined;
    do {
      const params = new URLSearchParams();
      params.set("size", "100");
      params.set("includeTotalCount", "true");
      if (cursor) params.set("cursor", cursor);
      if (extraParams) {
        extraParams.forEach((value, key) => {
          params.append(key, value);
        });
      }
      const result = await this.request<CursorResponse<T>>(path, params);
      const page = result.data ?? [];
      items.push(...page);
      cursor = result.pagination?.cursor ?? null;
    } while (cursor && items.length < max);
    return items;
  }

  async listWorkspaces(): Promise<DrataWorkspace[]> {
    const params = new URLSearchParams();
    params.set("size", "50");
    params.set("includeTotalCount", "true");
    const result = await this.request<CursorResponse<DrataWorkspace>>(
      "/workspaces",
      params
    );
    return result.data ?? [];
  }

  private async resolveRiskRegisterId(): Promise<number> {
    if (this.cachedRiskRegisterId) return this.cachedRiskRegisterId;
    const params = new URLSearchParams();
    params.set("size", "1");
    params.set("includeTotalCount", "true");
    const result = await this.request<CursorResponse<{ id: number }>>(
      "/risk-registers",
      params
    );
    const registers = result.data ?? [];
    if (!registers.length) throw new Error("No risk registers found");
    const first = registers[0];
    if (!first) throw new Error("No risk registers found");
    this.cachedRiskRegisterId = first.id;
    return this.cachedRiskRegisterId;
  }

  async getFrameworks(workspaceId: number): Promise<DrataFramework[]> {
    return this.fetchAll<DrataFramework>(`/workspaces/${workspaceId}/frameworks`);
  }

  async getControls(workspaceId: number): Promise<DrataControl[]> {
    const extraParams = new URLSearchParams();
    extraParams.append("expand[]", "flags");
    extraParams.append("expand[]", "frameworkTags");
    extraParams.append("expand[]", "owners");
    return this.fetchAll<DrataControl>(
      `/workspaces/${workspaceId}/controls`,
      extraParams
    );
  }

  async getTasks(workspaceId: number): Promise<DrataTask[]> {
    return this.fetchAll<DrataTask>(`/workspaces/${workspaceId}/tasks`, undefined, 500);
  }

  async getRisks(): Promise<DrataRisk[]> {
    const regId = await this.resolveRiskRegisterId();
    return this.fetchAll<DrataRisk>(`/risk-registers/${regId}/risks`, undefined, 500);
  }

  async getMonitoringTests(workspaceId: number): Promise<DrataMonitoringTest[]> {
    return this.fetchAll<DrataMonitoringTest>(
      `/workspaces/${workspaceId}/monitoring-tests`,
      undefined,
      500
    );
  }

  async getEvidenceLibrary(workspaceId: number): Promise<DrataEvidenceItem[]> {
    const extra = new URLSearchParams();
    extra.append("expand[]", "versions");
    extra.append("expand[]", "controls");
    return this.fetchAll<DrataEvidenceItem>(
      `/workspaces/${workspaceId}/evidence-library`,
      extra,
      500
    );
  }

  async getEvents(workspaceId: number, limit = 20): Promise<DrataEvent[]> {
    // Events endpoint may not be available in all plans — fall back gracefully
    try {
      const params = new URLSearchParams();
      params.set("size", String(limit));
      const result = await this.request<CursorResponse<DrataEvent>>(
        `/workspaces/${workspaceId}/events`,
        params
      );
      return result.data ?? [];
    } catch {
      return [];
    }
  }
}

function getTenantConfigs(): Workspace[] {
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

/** Returns a DrataClient for the given API key */
export function getClientForKey(apiKey: string): DrataClient {
  return new DrataClient(apiKey);
}

/** Returns all tenant API keys + labels */
export function getTenants(): Workspace[] {
  const tenants = getTenantConfigs();
  if (!tenants.length) {
    throw new Error("No Drata credentials configured. Set DRATA_API_KEY or DRATA_TENANTS.");
  }
  return tenants;
}

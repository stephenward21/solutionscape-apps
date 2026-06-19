import type {
  DrataWorkspace,
  DrataFramework,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
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
      throw new Error(`Drata API ${res.status} for ${path}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

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
        extraParams.forEach((value, key) => params.append(key, value));
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
    const result = await this.request<CursorResponse<DrataWorkspace>>("/workspaces", params);
    return result.data ?? [];
  }

  async getFrameworks(workspaceId: number): Promise<DrataFramework[]> {
    return this.fetchAll<DrataFramework>(`/workspaces/${workspaceId}/frameworks`);
  }

  async getControls(workspaceId: number): Promise<DrataControl[]> {
    const extra = new URLSearchParams();
    extra.append("expand[]", "flags");
    extra.append("expand[]", "frameworkTags");
    extra.append("expand[]", "owners");
    return this.fetchAll<DrataControl>(`/workspaces/${workspaceId}/controls`, extra);
  }

  async getTasks(workspaceId: number): Promise<DrataTask[]> {
    return this.fetchAll<DrataTask>(`/workspaces/${workspaceId}/tasks`, undefined, 500);
  }

  async getRisks(): Promise<DrataRisk[]> {
    const regId = await this.resolveRiskRegisterId();
    return this.fetchAll<DrataRisk>(`/risk-registers/${regId}/risks`, undefined, 500);
  }

  async getMonitoringTests(workspaceId: number): Promise<DrataMonitoringTest[]> {
    const extra = new URLSearchParams();
    extra.append("expand[]", "controls");
    return this.fetchAll<DrataMonitoringTest>(
      `/workspaces/${workspaceId}/monitoring-tests`,
      extra,
      500
    );
  }

  private async resolveRiskRegisterId(): Promise<number> {
    if (this.cachedRiskRegisterId) return this.cachedRiskRegisterId;
    const params = new URLSearchParams();
    params.set("size", "1");
    params.set("includeTotalCount", "true");
    const result = await this.request<CursorResponse<{ id: number }>>("/risk-registers", params);
    const registers = result.data ?? [];
    if (!registers.length) throw new Error("No risk registers found");
    const first = registers[0];
    if (!first) throw new Error("No risk registers found");
    this.cachedRiskRegisterId = first.id;
    return this.cachedRiskRegisterId;
  }
}

export function makeClient(apiKey: string): DrataClient {
  return new DrataClient(apiKey);
}

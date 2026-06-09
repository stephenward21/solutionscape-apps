import type { DrataWorkspace, DrataFramework, DrataControl } from "./types";

const BASE_URL = "https://public-api.drata.com/public/v2";

interface CursorResponse<T> {
  data: T[];
  pagination?: { cursor?: string | null; totalCount?: number };
}

export class DrataClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) params.forEach((v, k) => url.searchParams.append(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Drata API ${res.status} for ${path}: ${text}`);
    }
    return res.json() as Promise<T>;
  }

  private async fetchAll<T>(path: string, extra?: URLSearchParams, max = 1000): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null | undefined;
    do {
      const params = new URLSearchParams();
      params.set("size", "100");
      params.set("includeTotalCount", "true");
      if (cursor) params.set("cursor", cursor);
      if (extra) extra.forEach((v, k) => params.append(k, v));
      const result = await this.request<CursorResponse<T>>(path, params);
      items.push(...(result.data ?? []));
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
    return this.fetchAll<DrataControl>(`/workspaces/${workspaceId}/controls`, extra);
  }
}

export function makeClient(apiKey: string): DrataClient {
  return new DrataClient(apiKey);
}

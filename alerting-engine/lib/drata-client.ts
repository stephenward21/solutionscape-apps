import type { DrataWorkspace, DrataControl, DrataTask, DrataRisk, DrataMonitoringTest } from "./types";

const BASE_URL = "https://public-api.drata.com/public/v2";

interface CursorResponse<T> {
  data: T[];
  pagination?: { cursor?: string | null };
}

export class DrataClient {
  private readonly apiKey: string;
  private cachedRiskRegisterId?: number;

  constructor(apiKey: string) { this.apiKey = apiKey; }

  private async req<T>(path: string, params?: URLSearchParams): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) params.forEach((v, k) => url.searchParams.append(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Drata ${res.status} ${path}: ${await res.text().catch(() => res.statusText)}`);
    return res.json() as Promise<T>;
  }

  private async fetchAll<T>(path: string, extra?: URLSearchParams, max = 500): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | null | undefined;
    do {
      const p = new URLSearchParams();
      p.set("size", "100");
      p.set("includeTotalCount", "true");
      if (cursor) p.set("cursor", cursor);
      if (extra) extra.forEach((v, k) => p.append(k, v));
      const r = await this.req<CursorResponse<T>>(path, p);
      items.push(...(r.data ?? []));
      cursor = r.pagination?.cursor ?? null;
    } while (cursor && items.length < max);
    return items;
  }

  async listWorkspaces(): Promise<DrataWorkspace[]> {
    const p = new URLSearchParams(); p.set("size", "50"); p.set("includeTotalCount", "true");
    return (await this.req<CursorResponse<DrataWorkspace>>("/workspaces", p)).data ?? [];
  }

  async getControls(workspaceId: number): Promise<DrataControl[]> {
    const extra = new URLSearchParams();
    extra.append("expand[]", "flags");
    extra.append("expand[]", "frameworkTags");
    extra.append("expand[]", "owners");
    return this.fetchAll<DrataControl>(`/workspaces/${workspaceId}/controls`, extra);
  }

  async getTasks(workspaceId: number): Promise<DrataTask[]> {
    return this.fetchAll<DrataTask>(`/workspaces/${workspaceId}/tasks`);
  }

  async getMonitoringTests(workspaceId: number): Promise<DrataMonitoringTest[]> {
    return this.fetchAll<DrataMonitoringTest>(`/workspaces/${workspaceId}/monitoring-tests`);
  }

  async getRisks(): Promise<DrataRisk[]> {
    const regId = await this.resolveRiskRegisterId();
    return this.fetchAll<DrataRisk>(`/risk-registers/${regId}/risks`);
  }

  private async resolveRiskRegisterId(): Promise<number> {
    if (this.cachedRiskRegisterId) return this.cachedRiskRegisterId;
    const p = new URLSearchParams(); p.set("size", "1"); p.set("includeTotalCount", "true");
    const r = await this.req<CursorResponse<{ id: number }>>("/risk-registers", p);
    const first = r.data?.[0];
    if (!first) throw new Error("No risk registers found");
    this.cachedRiskRegisterId = first.id;
    return this.cachedRiskRegisterId;
  }
}

export const makeClient = (apiKey: string) => new DrataClient(apiKey);

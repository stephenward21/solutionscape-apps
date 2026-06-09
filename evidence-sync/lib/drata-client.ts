import type { DrataFramework, DrataControl, DrataEvidence, Workspace } from "./types";

const BASE_URL = "https://public-api.drata.com/public/v2";

interface CursorResponse<T> {
  data: T[];
  pagination?: { cursor?: string | null; totalCount?: number };
}

export class DrataClient {
  private readonly apiKey: string;
  private cachedWorkspaceId?: number;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }
    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`Drata API error ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
  }

  private async resolveWorkspaceId(): Promise<number> {
    if (this.cachedWorkspaceId) return this.cachedWorkspaceId;
    const result = await this.request<CursorResponse<{ id: number; primary?: boolean }>>(
      "/workspaces",
      {},
      { size: "50", includeTotalCount: "true" }
    );
    const workspaces = result.data ?? [];
    if (!workspaces.length) throw new Error("No workspaces found");
    const primary = workspaces.find((w) => w.primary) ?? workspaces[0];
    if (!primary) throw new Error("No workspaces found");
    this.cachedWorkspaceId = primary.id;
    return this.cachedWorkspaceId;
  }

  async getFrameworks(): Promise<DrataFramework[]> {
    const wsId = await this.resolveWorkspaceId();
    const items: DrataFramework[] = [];
    let cursor: string | null | undefined = undefined;
    do {
      const params: Record<string, string> = {
        size: "100",
        includeTotalCount: "true",
        ...(cursor ? { cursor } : {}),
      };
      const result = await this.request<CursorResponse<DrataFramework>>(
        `/workspaces/${wsId}/frameworks`,
        {},
        params
      );
      items.push(...(result.data ?? []));
      cursor = result.pagination?.cursor ?? null;
    } while (cursor);
    return items;
  }

  async getControls(opts?: { frameworkName?: string; search?: string }): Promise<DrataControl[]> {
    const wsId = await this.resolveWorkspaceId();
    const allControls: DrataControl[] = [];
    let cursor: string | null | undefined = undefined;
    do {
      const params: Record<string, string> = {
        size: "100",
        includeTotalCount: "true",
        ...(cursor ? { cursor } : {}),
      };
      const result = await this.request<CursorResponse<DrataControl>>(
        `/workspaces/${wsId}/controls`,
        {},
        params
      );
      allControls.push(...(result.data ?? []));
      cursor = result.pagination?.cursor ?? null;
    } while (cursor && allControls.length < 1000);

    // Framework filtering is done client-side via frameworkTags (v2 has no server-side filter)
    let filtered = allControls;
    if (opts?.frameworkName) {
      const name = opts.frameworkName.toLowerCase();
      filtered = filtered.filter((c) =>
        c.frameworkTags?.some((tag) => tag.toLowerCase() === name)
      );
    }
    // Search filtering (v2 has no server-side text search on controls)
    if (opts?.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.code ?? "").toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  async getEvidenceList(controlId?: number): Promise<DrataEvidence[]> {
    const wsId = await this.resolveWorkspaceId();
    const path = `/workspaces/${wsId}/evidence-library`;
    const params: Record<string, string> = { size: "100", includeTotalCount: "true" };
    if (controlId) params.controlId = String(controlId);
    try {
      const result = await this.request<CursorResponse<DrataEvidence> | DrataEvidence[]>(
        path,
        {},
        params
      );
      if (Array.isArray(result)) return result;
      return result.data ?? [];
    } catch {
      // Evidence library endpoint path may vary — fall back gracefully
      return [];
    }
  }

  async uploadEvidence(
    file: Buffer,
    fileName: string,
    mimeType: string,
    controlId: number,
    description: string,
    collectedAt: string
  ): Promise<DrataEvidence> {
    const wsId = await this.resolveWorkspaceId();
    const formData = new FormData();
    const ab = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("controlId", String(controlId));
    formData.append("description", description);
    formData.append("collectedAt", collectedAt);

    const url = `${BASE_URL}/workspaces/${wsId}/evidence-library`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Drata API error ${response.status}: ${text}`);
    }
    return response.json() as Promise<DrataEvidence>;
  }

  async deleteEvidence(evidenceId: number): Promise<void> {
    const wsId = await this.resolveWorkspaceId();
    await this.request(
      `/workspaces/${wsId}/evidence-library/${evidenceId}`,
      { method: "DELETE" }
    );
  }
}

function getWorkspaces(): Workspace[] {
  if (process.env.DRATA_TENANTS) {
    try {
      const parsed = JSON.parse(process.env.DRATA_TENANTS) as unknown;
      if (Array.isArray(parsed)) return parsed as Workspace[];
    } catch {
      // fall through
    }
  }
  if (process.env.DRATA_API_KEY) {
    return [{ name: "Default", apiKey: process.env.DRATA_API_KEY }];
  }
  return [];
}

export function getClient(workspaceName?: string): DrataClient {
  const workspaces = getWorkspaces();
  if (!workspaces.length) {
    throw new Error("No Drata API credentials configured. Set DRATA_API_KEY or DRATA_TENANTS.");
  }
  if (!workspaceName || workspaceName === "Default") {
    return new DrataClient(workspaces[0]!.apiKey);
  }
  const workspace = workspaces.find((w) => w.name === workspaceName);
  if (!workspace) throw new Error(`Workspace "${workspaceName}" not found.`);
  return new DrataClient(workspace.apiKey);
}

export function listWorkspaceNames(): string[] {
  return getWorkspaces().map((w) => w.name);
}

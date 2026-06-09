import type { DrataFramework, DrataControl, DrataEvidence, Workspace } from "./types";

const BASE_URL = "https://public-api.drata.com/public";

export class DrataClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Drata API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async getFrameworks(): Promise<DrataFramework[]> {
    const data = await this.request<{ data: DrataFramework[] } | DrataFramework[]>("/frameworks");
    if (Array.isArray(data)) return data;
    if ("data" in data && Array.isArray(data.data)) return data.data;
    return [];
  }

  async getControls(opts?: {
    frameworkSlug?: string;
    search?: string;
    page?: number;
  }): Promise<DrataControl[]> {
    const allControls: DrataControl[] = [];
    let page = opts?.page ?? 1;
    const pageSize = 100;

    while (allControls.length < 500) {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (opts?.frameworkSlug) params.set("frameworkSlug", opts.frameworkSlug);
      if (opts?.search) params.set("search", opts.search);

      const data = await this.request<
        | { data: DrataControl[]; totalCount?: number; total?: number }
        | DrataControl[]
      >(`/controls?${params.toString()}`);

      let controls: DrataControl[];
      let total: number | undefined;

      if (Array.isArray(data)) {
        controls = data;
      } else {
        controls = data.data ?? [];
        total = data.totalCount ?? data.total;
      }

      if (controls.length === 0) break;

      allControls.push(...controls);

      // If search or single page requested, stop after first page
      if (opts?.search || opts?.page !== undefined) break;

      // If we got less than a full page, we're done
      if (controls.length < pageSize) break;

      // If total known and we have all
      if (total !== undefined && allControls.length >= total) break;

      page++;
    }

    return allControls;
  }

  async getEvidenceList(controlId?: number): Promise<DrataEvidence[]> {
    const params = controlId ? `?controlId=${controlId}` : "";
    const data = await this.request<
      { data: DrataEvidence[] } | DrataEvidence[]
    >(`/evidence-library${params}`);
    if (Array.isArray(data)) return data;
    if ("data" in data && Array.isArray(data.data)) return data.data;
    return [];
  }

  async uploadEvidence(
    file: Buffer,
    fileName: string,
    mimeType: string,
    controlId: number,
    description: string,
    collectedAt: string
  ): Promise<DrataEvidence> {
    const formData = new FormData();
    // Copy into a plain ArrayBuffer to satisfy strict Blob typing
    const ab = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const blob = new Blob([ab], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("controlId", String(controlId));
    formData.append("description", description);
    formData.append("collectedAt", collectedAt);

    const url = `${BASE_URL}/evidence-library`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(`Drata API error ${response.status}: ${text}`);
    }

    return response.json() as Promise<DrataEvidence>;
  }

  async deleteEvidence(evidenceId: number): Promise<void> {
    await this.request(`/evidence-library/${evidenceId}`, { method: "DELETE" });
  }
}

function getWorkspaces(): Workspace[] {
  if (process.env.DRATA_TENANTS) {
    try {
      const parsed = JSON.parse(process.env.DRATA_TENANTS) as unknown;
      if (Array.isArray(parsed)) {
        return parsed as Workspace[];
      }
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

  if (workspaces.length === 0) {
    throw new Error("No Drata API credentials configured. Set DRATA_API_KEY or DRATA_TENANTS.");
  }

  if (!workspaceName || workspaceName === "Default") {
    return new DrataClient(workspaces[0].apiKey);
  }

  const workspace = workspaces.find((w) => w.name === workspaceName);
  if (!workspace) {
    throw new Error(`Workspace "${workspaceName}" not found in configuration.`);
  }

  return new DrataClient(workspace.apiKey);
}

export function listWorkspaceNames(): string[] {
  return getWorkspaces().map((w) => w.name);
}

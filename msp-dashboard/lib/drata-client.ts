import type {
  DrataFramework,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
  DrataEvent,
  Workspace,
} from "./types";

const BASE_URL = "https://public-api.drata.com/public";

type PaginatedResponse<T> = { data: T[]; totalCount: number } | T[];

function extractData<T>(response: PaginatedResponse<T>): { items: T[]; total: number } {
  if (Array.isArray(response)) {
    return { items: response, total: response.length };
  }
  return { items: response.data, total: response.totalCount };
}

export class DrataClient {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Drata API error ${res.status} for ${path}: ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  }

  async getFrameworks(): Promise<DrataFramework[]> {
    const response = await this.fetch<PaginatedResponse<DrataFramework>>("/frameworks");
    return extractData(response).items;
  }

  async getControls(opts?: { frameworkSlug?: string }): Promise<DrataControl[]> {
    const allControls: DrataControl[] = [];
    const pageSize = 100;
    let page = 1;
    const max = 1000;

    while (allControls.length < max) {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (opts?.frameworkSlug) {
        params.frameworkSlug = opts.frameworkSlug;
      }
      const response = await this.fetch<PaginatedResponse<DrataControl>>("/controls", params);
      const { items, total } = extractData(response);
      allControls.push(...items);
      if (items.length < pageSize || allControls.length >= total) break;
      page++;
    }

    return allControls;
  }

  async getTasks(): Promise<DrataTask[]> {
    const allTasks: DrataTask[] = [];
    const pageSize = 100;
    let page = 1;
    const max = 500;

    while (allTasks.length < max) {
      const response = await this.fetch<PaginatedResponse<DrataTask>>("/tasks", {
        page: String(page),
        pageSize: String(pageSize),
      });
      const { items, total } = extractData(response);
      allTasks.push(...items);
      if (items.length < pageSize || allTasks.length >= total) break;
      page++;
    }

    return allTasks;
  }

  async getRisks(): Promise<DrataRisk[]> {
    const allRisks: DrataRisk[] = [];
    const pageSize = 100;
    let page = 1;
    const max = 500;

    while (allRisks.length < max) {
      const response = await this.fetch<PaginatedResponse<DrataRisk>>("/risks", {
        page: String(page),
        pageSize: String(pageSize),
      });
      const { items, total } = extractData(response);
      allRisks.push(...items);
      if (items.length < pageSize || allRisks.length >= total) break;
      page++;
    }

    return allRisks;
  }

  async getMonitoringTests(): Promise<DrataMonitoringTest[]> {
    const allTests: DrataMonitoringTest[] = [];
    const pageSize = 100;
    let page = 1;
    const max = 500;

    while (allTests.length < max) {
      const response = await this.fetch<PaginatedResponse<DrataMonitoringTest>>(
        "/monitoring-tests",
        {
          page: String(page),
          pageSize: String(pageSize),
        }
      );
      const { items, total } = extractData(response);
      allTests.push(...items);
      if (items.length < pageSize || allTests.length >= total) break;
      page++;
    }

    return allTests;
  }

  async getEvents(pageSize = 20): Promise<DrataEvent[]> {
    const response = await this.fetch<PaginatedResponse<DrataEvent>>("/events", {
      page: "1",
      pageSize: String(pageSize),
    });
    return extractData(response).items;
  }
}

function getWorkspaces(): Workspace[] {
  const tenantsEnv = process.env.DRATA_TENANTS;
  if (tenantsEnv) {
    try {
      const parsed = JSON.parse(tenantsEnv) as Workspace[];
      return parsed;
    } catch {
      throw new Error("DRATA_TENANTS is not valid JSON");
    }
  }
  const singleKey = process.env.DRATA_API_KEY;
  if (singleKey) {
    return [{ name: "Default", apiKey: singleKey }];
  }
  return [];
}

export function getClient(workspaceName?: string): DrataClient {
  const workspaces = getWorkspaces();
  if (workspaces.length === 0) {
    throw new Error("No Drata credentials configured. Set DRATA_API_KEY or DRATA_TENANTS.");
  }
  if (!workspaceName) {
    return new DrataClient(workspaces[0].apiKey);
  }
  const workspace = workspaces.find(
    (w) => w.name.toLowerCase() === workspaceName.toLowerCase()
  );
  if (!workspace) {
    throw new Error(`Workspace "${workspaceName}" not found in configuration`);
  }
  return new DrataClient(workspace.apiKey);
}

export function listWorkspaceNames(): string[] {
  return getWorkspaces().map((w) => w.name);
}

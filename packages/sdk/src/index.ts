export interface StateBaseClientOptions {
  baseUrl: string;
  token?: string;
  fetchImpl?: typeof fetch;
}

export interface ListOptions {
  orgId: string;
  page?: number;
  pageSize?: number;
  workspaceId?: string;
  stateVersionId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  [key: string]: unknown;
}

export interface SqlQueryInput {
  orgId: string;
  sql: string;
  workspaceIds?: string[];
  limit?: number;
}

export interface IngestTfstateInput {
  orgId: string;
  workspaceId: string;
  source: "upload" | "ci" | "s3" | "terraform-cloud" | "local";
  state: unknown;
  metadata?: Record<string, unknown>;
}

export interface CreateWorkspaceInput {
  orgId: string;
  name: string;
  slug?: string;
  projectId?: string;
  projectName?: string;
  environment?: string;
  description?: string;
}

export class StateBaseApiError extends Error {
  constructor(public status: number, message: string, public body: unknown) {
    super(message);
    this.name = "StateBaseApiError";
  }
}

function queryString(input: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || key === "orgId") continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export class StateBaseClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: StateBaseClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() : await response.text();
    if (!response.ok) {
      const message = typeof body === "object" && body && "message" in body ? String((body as any).message) : response.statusText;
      throw new StateBaseApiError(response.status, message, body);
    }
    return body as T;
  }

  health() {
    return this.request<{ ok: boolean }>("/health");
  }

  workspaces = {
    list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/workspaces${queryString(input)}`),
    get: (input: { orgId: string; workspaceId: string }) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/workspaces/${encodeURIComponent(input.workspaceId)}`),
    create: (input: CreateWorkspaceInput) => {
      const { orgId, ...body } = input;
      return this.request(`/api/v1/orgs/${encodeURIComponent(orgId)}/workspaces`, { method: "POST", body: JSON.stringify(body) });
    }
  };

  stateVersions = {
    list: (input: ListOptions & { workspaceId: string }) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/workspaces/${encodeURIComponent(input.workspaceId)}/state-versions${queryString(input)}`),
    get: (input: { orgId: string; stateVersionId: string }) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/state-versions/${encodeURIComponent(input.stateVersionId)}`)
  };

  resources = {
    list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/resources${queryString(input)}`),
    get: (input: { orgId: string; resourceId: string }) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/resources/${encodeURIComponent(input.resourceId)}`)
  };

  modules = { list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/modules${queryString(input)}`) };
  providers = { list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/providers${queryString(input)}`) };
  outputs = { list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/outputs${queryString(input)}`) };
  dependencies = { list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/dependencies${queryString(input)}`) };
  changeEvents = { list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/change-events${queryString(input)}`) };
  driftEvents = {
    list: (input: ListOptions) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/drift-events${queryString(input)}`),
    check: (input: { orgId: string; workspaceId: string }) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/workspaces/${encodeURIComponent(input.workspaceId)}/drift/check`, { method: "POST", body: JSON.stringify({}) })
  };

  ingest = {
    tfstate: (input: IngestTfstateInput) => this.request(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/workspaces/${encodeURIComponent(input.workspaceId)}/ingest/tfstate`, {
      method: "POST",
      body: JSON.stringify({ source: input.source, state: input.state, metadata: input.metadata ?? {} })
    })
  };

  query = {
    sql: (input: SqlQueryInput) => this.request<{ columns: string[]; rows: Record<string, unknown>[]; elapsedMs: number }>(`/api/v1/orgs/${encodeURIComponent(input.orgId)}/query/sql`, {
      method: "POST",
      body: JSON.stringify({ sql: input.sql, workspaceIds: input.workspaceIds ?? [], limit: input.limit ?? 1000 })
    })
  };
}

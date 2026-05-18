import { randomUUID } from "node:crypto";
import {
  diffSnapshots,
  emptySnapshot,
  snapshotFromParsedState,
  type ChangeEventDraft,
  type JsonValue,
  type ParsedState,
  type StateSnapshot
} from "@statebase/core";
import type { PgClient, PgPool } from "./client.js";

export interface PageOptions {
  page?: number;
  pageSize?: number;
  workspaceId?: string;
  stateVersionId?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  type?: string;
  provider?: string;
  module?: string;
  environment?: string;
  severity?: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface InsertParsedStateInput {
  orgId: string;
  workspaceId: string;
  source: "upload" | "ci" | "s3" | "terraform-cloud" | "local" | string;
  metadata?: Record<string, unknown>;
  parsed: ParsedState;
}

export interface IngestSummary {
  stateVersionId: string;
  resources: number;
  attributes: number;
  outputs: number;
  redactedAttributes: number;
  changeEvents: number;
}

function jsonParam(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
}

function toInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export async function assertOrganization(pool: PgPool, orgId: string): Promise<void> {
  const result = await pool.query("SELECT id FROM organizations WHERE id = $1", [orgId]);
  if (!result.rowCount) throw new Error(`Organization ${orgId} was not found`);
}

export async function assertWorkspace(pool: PgPool | PgClient, orgId: string, workspaceId: string): Promise<void> {
  const result = await pool.query("SELECT id FROM workspaces WHERE id = $1 AND org_id = $2", [workspaceId, orgId]);
  if (!result.rowCount) throw new Error(`Workspace ${workspaceId} was not found in organization ${orgId}`);
}

export async function createWorkspace(pool: PgPool, input: {
  orgId: string;
  projectId?: string;
  projectName?: string;
  name: string;
  slug?: string;
  environment?: string;
  description?: string;
}): Promise<Record<string, unknown>> {
  await assertOrganization(pool, input.orgId);
  let projectId = input.projectId;
  if (!projectId) {
    const projectSlug = slugify(input.projectName ?? "default");
    const existing = await pool.query("SELECT id FROM projects WHERE org_id = $1 AND slug = $2", [input.orgId, projectSlug]);
    if (existing.rowCount) projectId = existing.rows[0].id;
    else {
      projectId = `proj_${randomUUID()}`;
      await pool.query("INSERT INTO projects(id, org_id, name, slug) VALUES ($1, $2, $3, $4)", [projectId, input.orgId, input.projectName ?? "Default", projectSlug]);
    }
  }
  const id = `ws_${randomUUID()}`;
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const result = await pool.query(
    `INSERT INTO workspaces(id, org_id, project_id, name, slug, environment, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, input.orgId, projectId, input.name, slug, input.environment ?? null, input.description ?? null]
  );
  return result.rows[0];
}

const TABLE_CONFIG = {
  workspaces: {
    table: "workspaces",
    search: ["name", "slug", "environment", "description"],
    sort: ["created_at", "updated_at", "name", "slug", "environment"]
  },
  state_versions: {
    table: "state_versions",
    search: ["terraform_version", "lineage", "source"],
    sort: ["created_at", "serial", "terraform_version", "resources_count", "attributes_count", "outputs_count"]
  },
  resources: {
    table: "resources",
    search: ["address", "type", "name", "provider_name", "module_address"],
    sort: ["created_at", "address", "type", "name", "provider_name"]
  },
  modules: {
    table: "modules",
    search: ["address", "parent_address"],
    sort: ["created_at", "address", "parent_address"]
  },
  providers: {
    table: "providers",
    search: ["name", "source", "address", "alias", "version"],
    sort: ["created_at", "name", "source", "version"]
  },
  outputs: {
    table: "outputs",
    search: ["name", "display_value"],
    sort: ["created_at", "name", "is_sensitive"]
  },
  dependencies: {
    table: "dependencies",
    search: ["source_address", "target_address", "dependency_type"],
    sort: ["created_at", "source_address", "target_address"]
  },
  change_events: {
    table: "change_events",
    search: ["type", "address", "key_path", "severity", "summary"],
    sort: ["created_at", "type", "severity", "address"]
  },
  drift_events: {
    table: "drift_events",
    search: ["resource_address", "provider", "status", "severity", "summary"],
    sort: ["created_at", "severity", "status", "provider"]
  }
} as const;

export type ListTableName = keyof typeof TABLE_CONFIG;

function buildListQuery(tableName: ListTableName, orgId: string, options: PageOptions = {}) {
  const config = TABLE_CONFIG[tableName];
  const params: unknown[] = [orgId];
  const where = [`org_id = $1`];
  if (options.workspaceId) {
    params.push(options.workspaceId);
    where.push(tableName === "workspaces" ? `id = $${params.length}` : `workspace_id = $${params.length}`);
  }
  if (options.stateVersionId && tableName !== "workspaces") {
    params.push(options.stateVersionId);
    where.push(`state_version_id = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search}%`);
    const idx = params.length;
    where.push(`(${config.search.map((col) => `${col} ILIKE $${idx}`).join(" OR ")})`);
  }
  if (options.type && tableName === "resources") {
    params.push(options.type);
    where.push(`type = $${params.length}`);
  }
  if (options.provider) {
    params.push(options.provider);
    if (tableName === "resources") where.push(`provider_name = $${params.length}`);
    else if (tableName === "providers") where.push(`name = $${params.length}`);
  }
  if (options.module) {
    params.push(options.module);
    if (tableName === "resources") where.push(`module_address = $${params.length}`);
    else if (tableName === "modules") where.push(`address = $${params.length}`);
  }
  if (options.environment && tableName === "workspaces") {
    params.push(options.environment);
    where.push(`environment = $${params.length}`);
  }
  if (options.severity && (tableName === "change_events" || tableName === "drift_events")) {
    params.push(options.severity);
    where.push(`severity = $${params.length}`);
  }
  const sortBy = config.sort.includes(options.sortBy as never) ? options.sortBy! : "created_at";
  const sortDir = options.sortDir === "asc" ? "ASC" : "DESC";
  const page = Math.max(1, toInt(options.page, 1));
  const pageSize = Math.max(1, Math.min(250, toInt(options.pageSize, 50)));
  const offset = (page - 1) * pageSize;
  return { table: config.table, params, where: where.join(" AND "), sortBy, sortDir, page, pageSize, offset };
}

export async function listRows<T = Record<string, unknown>>(pool: PgPool, tableName: ListTableName, orgId: string, options: PageOptions = {}): Promise<PagedResult<T>> {
  const query = buildListQuery(tableName, orgId, options);
  const rows = await pool.query(
    `SELECT *, COUNT(*) OVER()::int AS _total
     FROM ${query.table}
     WHERE ${query.where}
     ORDER BY ${query.sortBy} ${query.sortDir}
     LIMIT $${query.params.length + 1} OFFSET $${query.params.length + 2}`,
    [...query.params, query.pageSize, query.offset]
  );
  const total = rows.rowCount ? Number(rows.rows[0]._total) : 0;
  return {
    items: rows.rows.map(({ _total, ...row }) => row) as T[],
    total,
    page: query.page,
    pageSize: query.pageSize
  };
}

export async function getWorkspace(pool: PgPool, orgId: string, workspaceId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query("SELECT * FROM workspaces WHERE org_id = $1 AND id = $2", [orgId, workspaceId]);
  return result.rows[0] ?? null;
}

export async function getStateVersion(pool: PgPool, orgId: string, stateVersionId: string): Promise<Record<string, unknown> | null> {
  const result = await pool.query("SELECT * FROM state_versions WHERE org_id = $1 AND id = $2", [orgId, stateVersionId]);
  return result.rows[0] ?? null;
}

export async function getResourceDetail(pool: PgPool, orgId: string, resourceId: string): Promise<Record<string, unknown> | null> {
  const resource = await pool.query("SELECT * FROM resources WHERE id = $1 AND org_id = $2", [resourceId, orgId]);
  if (!resource.rowCount) return null;
  const instances = await pool.query("SELECT * FROM resource_instances WHERE resource_id = $1 AND org_id = $2 ORDER BY address", [resourceId, orgId]);
  const attributes = await pool.query("SELECT * FROM resource_attributes WHERE resource_id = $1 AND org_id = $2 ORDER BY resource_address, key_path", [resourceId, orgId]);
  return { ...resource.rows[0], instances: instances.rows, attributes: attributes.rows };
}

async function latestStateVersion(client: PgClient, orgId: string, workspaceId: string): Promise<string | null> {
  const result = await client.query(
    "SELECT id FROM state_versions WHERE org_id = $1 AND workspace_id = $2 ORDER BY created_at DESC, serial DESC LIMIT 1",
    [orgId, workspaceId]
  );
  return result.rows[0]?.id ?? null;
}

export async function loadSnapshot(client: PgPool | PgClient, orgId: string, stateVersionId: string): Promise<StateSnapshot> {
  const state = await client.query("SELECT id FROM state_versions WHERE org_id = $1 AND id = $2", [orgId, stateVersionId]);
  if (!state.rowCount) return emptySnapshot();

  const resources = new Map();
  const attributes = new Map();
  const outputs = new Map();
  const providers = new Map();
  const modules = new Map();

  const instanceRows = await client.query(
    `SELECT ri.address, r.mode, r.type, r.provider_address, r.module_address
     FROM resource_instances ri
     JOIN resources r ON r.id = ri.resource_id
     WHERE ri.org_id = $1 AND ri.state_version_id = $2`,
    [orgId, stateVersionId]
  );
  for (const row of instanceRows.rows) {
    resources.set(row.address, {
      address: row.address,
      mode: row.mode,
      type: row.type,
      providerAddress: row.provider_address ?? undefined,
      moduleAddress: row.module_address ?? undefined
    });
  }

  const attrRows = await client.query(
    `SELECT ra.resource_address, ra.key_path, ra.value_json, ra.display_value, ra.is_sensitive, r.type AS resource_type
     FROM resource_attributes ra
     JOIN resources r ON r.id = ra.resource_id
     WHERE ra.org_id = $1 AND ra.state_version_id = $2`,
    [orgId, stateVersionId]
  );
  for (const row of attrRows.rows) {
    attributes.set(`${row.resource_address}::${row.key_path}`, {
      resourceAddress: row.resource_address,
      keyPath: row.key_path,
      value: row.value_json,
      displayValue: row.display_value,
      isSensitive: row.is_sensitive,
      resourceType: row.resource_type
    });
  }

  const outputRows = await client.query("SELECT name, value_json, display_value, is_sensitive FROM outputs WHERE org_id = $1 AND state_version_id = $2", [orgId, stateVersionId]);
  for (const row of outputRows.rows) {
    outputs.set(row.name, { name: row.name, value: row.value_json, displayValue: row.display_value, isSensitive: row.is_sensitive });
  }

  const providerRows = await client.query("SELECT address, name, version, source FROM providers WHERE org_id = $1 AND state_version_id = $2", [orgId, stateVersionId]);
  for (const row of providerRows.rows) providers.set(row.address, { address: row.address, name: row.name, version: row.version ?? undefined, source: row.source ?? undefined });

  const moduleRows = await client.query("SELECT address, parent_address FROM modules WHERE org_id = $1 AND state_version_id = $2", [orgId, stateVersionId]);
  for (const row of moduleRows.rows) modules.set(row.address, { address: row.address, parentAddress: row.parent_address ?? undefined });

  return { resources, attributes, outputs, providers, modules };
}

async function insertChangeEvents(client: PgClient, input: {
  orgId: string;
  workspaceId: string;
  stateVersionId: string;
  previousStateVersionId: string | null;
  events: ChangeEventDraft[];
}) {
  for (const event of input.events) {
    await client.query(
      `INSERT INTO change_events(
        id, org_id, workspace_id, state_version_id, previous_state_version_id, type, address, key_path,
        old_value_json, new_value_json, old_display_value, new_display_value, severity, summary, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,$15::jsonb)`,
      [
        `chg_${randomUUID()}`,
        input.orgId,
        input.workspaceId,
        input.stateVersionId,
        input.previousStateVersionId,
        event.type,
        event.address ?? null,
        event.keyPath ?? null,
        jsonParam(event.oldValue ?? null),
        jsonParam(event.newValue ?? null),
        event.oldDisplayValue ?? null,
        event.newDisplayValue ?? null,
        event.severity,
        event.summary,
        jsonParam(event.metadata ?? {})
      ]
    );
  }
}

export async function insertParsedState(pool: PgPool, input: InsertParsedStateInput): Promise<IngestSummary> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertWorkspace(client, input.orgId, input.workspaceId);
    const previousStateVersionId = await latestStateVersion(client, input.orgId, input.workspaceId);
    const previousSnapshot = previousStateVersionId ? await loadSnapshot(client, input.orgId, previousStateVersionId) : emptySnapshot();

    const stateVersionId = `sv_${randomUUID()}`;
    const attributeCount = input.parsed.resources.flatMap((resource) => resource.instances).reduce((sum, instance) => sum + instance.attributes.length, 0);
    const redactedCount = input.parsed.resources.flatMap((resource) => resource.instances).reduce((sum, instance) => sum + instance.attributes.filter((attr) => attr.isSensitive).length, 0);

    await client.query(
      `INSERT INTO state_versions(
        id, org_id, workspace_id, terraform_version, serial, lineage, source, metadata,
        resources_count, attributes_count, outputs_count, redacted_attributes_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12)`,
      [
        stateVersionId,
        input.orgId,
        input.workspaceId,
        input.parsed.metadata.terraformVersion ?? null,
        input.parsed.metadata.serial,
        input.parsed.metadata.lineage,
        input.source,
        jsonParam(input.metadata ?? {}),
        input.parsed.resources.length,
        attributeCount,
        input.parsed.outputs.length,
        redactedCount
      ]
    );

    const providerIdByAddress = new Map<string, string>();
    for (const provider of input.parsed.providers) {
      const id = `prov_${randomUUID()}`;
      providerIdByAddress.set(provider.address, id);
      await client.query(
        `INSERT INTO providers(id, org_id, state_version_id, workspace_id, name, alias, version, source, address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, input.orgId, stateVersionId, input.workspaceId, provider.name, provider.alias ?? null, provider.version ?? null, provider.source ?? null, provider.address]
      );
    }

    const moduleIdByAddress = new Map<string, string>();
    for (const module of input.parsed.modules) {
      const id = `mod_${randomUUID()}`;
      moduleIdByAddress.set(module.address, id);
      await client.query(
        `INSERT INTO modules(id, org_id, state_version_id, workspace_id, address, path, parent_address)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [id, input.orgId, stateVersionId, input.workspaceId, module.address, jsonParam(module.path), module.parentAddress ?? null]
      );
    }

    const resourceIdByAddress = new Map<string, string>();
    for (const resource of input.parsed.resources) {
      const resourceId = `res_${randomUUID()}`;
      resourceIdByAddress.set(resource.address, resourceId);
      await client.query(
        `INSERT INTO resources(
          id, org_id, state_version_id, workspace_id, module_id, provider_id, mode, type, name, address,
          provider_name, provider_address, module_address
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          resourceId,
          input.orgId,
          stateVersionId,
          input.workspaceId,
          moduleIdByAddress.get(resource.moduleAddress ?? "root") ?? null,
          resource.providerAddress ? providerIdByAddress.get(resource.providerAddress) ?? null : null,
          resource.mode,
          resource.type,
          resource.name,
          resource.address,
          resource.providerName ?? null,
          resource.providerAddress ?? null,
          resource.moduleAddress ?? null
        ]
      );

      for (const instance of resource.instances) {
        const instanceId = `inst_${randomUUID()}`;
        await client.query(
          `INSERT INTO resource_instances(
            id, org_id, state_version_id, workspace_id, resource_id, address, index_key, schema_version,
            attributes_json, sensitive_paths_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
          [
            instanceId,
            input.orgId,
            stateVersionId,
            input.workspaceId,
            resourceId,
            instance.address,
            instance.indexKey === undefined ? null : String(instance.indexKey),
            instance.schemaVersion ?? null,
            jsonParam(instance.attributesJson),
            jsonParam(instance.sensitivePaths)
          ]
        );

        for (const attr of instance.attributes) {
          await client.query(
            `INSERT INTO resource_attributes(
              id, org_id, state_version_id, workspace_id, resource_id, resource_instance_id, resource_address,
              key_path, value_type, value_json, display_value, is_sensitive, sensitive_reason
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
            [
              `attr_${randomUUID()}`,
              input.orgId,
              stateVersionId,
              input.workspaceId,
              resourceId,
              instanceId,
              instance.address,
              attr.keyPath,
              attr.valueType,
              jsonParam(attr.value),
              attr.displayValue,
              attr.isSensitive,
              attr.sensitiveReason ?? null
            ]
          );
        }
      }
    }

    for (const output of input.parsed.outputs) {
      await client.query(
        `INSERT INTO outputs(id, org_id, state_version_id, workspace_id, name, value_json, display_value, type_json, is_sensitive, sensitive_reason)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb,$9,$10)`,
        [
          `out_${randomUUID()}`,
          input.orgId,
          stateVersionId,
          input.workspaceId,
          output.name,
          jsonParam(output.value),
          output.displayValue,
          output.type === undefined ? null : jsonParam(output.type),
          output.isSensitive,
          output.sensitiveReason ?? null
        ]
      );
    }

    for (const dependency of input.parsed.dependencies) {
      const baseSource = dependency.sourceAddress.replace(/\[[^\]]+\]$/, "");
      await client.query(
        `INSERT INTO dependencies(id, org_id, state_version_id, workspace_id, resource_id, source_address, target_address, dependency_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          `dep_${randomUUID()}`,
          input.orgId,
          stateVersionId,
          input.workspaceId,
          resourceIdByAddress.get(baseSource) ?? null,
          dependency.sourceAddress,
          dependency.targetAddress,
          dependency.dependencyType
        ]
      );
    }

    const currentSnapshot = snapshotFromParsedState(input.parsed);
    const events = diffSnapshots(previousSnapshot, currentSnapshot);
    await insertChangeEvents(client, { orgId: input.orgId, workspaceId: input.workspaceId, stateVersionId, previousStateVersionId, events });

    await client.query("COMMIT");
    return {
      stateVersionId,
      resources: input.parsed.resources.length,
      attributes: attributeCount,
      outputs: input.parsed.outputs.length,
      redactedAttributes: redactedCount,
      changeEvents: events.length
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

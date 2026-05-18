import { randomUUID } from "node:crypto";
import { clampQueryLimit, validateReadOnlySql } from "@statebase/core";
import type { PgClient, PgPool } from "./client.js";

export interface ExecuteScopedSqlInput {
  orgId: string;
  userId?: string | null;
  apiTokenId?: string | null;
  sql: string;
  workspaceIds?: string[];
  limit?: number;
  timeoutMs?: number;
  maxRows?: number;
}

export interface ExecuteScopedSqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  elapsedMs: number;
}

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function workspaceArray(workspaceIds: string[] | undefined): string | null {
  if (!workspaceIds?.length) return null;
  return `ARRAY[${workspaceIds.map(literal).join(",")}]::text[]`;
}

function workspaceFilter(workspaceIds: string[] | undefined, column = "workspace_id"): string {
  const arrayLiteral = workspaceArray(workspaceIds);
  return arrayLiteral ? ` AND ${column} = ANY(${arrayLiteral})` : "";
}

async function createScopedTempViews(client: PgClient, orgId: string, workspaceIds?: string[]): Promise<void> {
  const org = literal(orgId);
  const ws = workspaceFilter(workspaceIds);
  const wsById = workspaceFilter(workspaceIds, "id");
  const views: Array<{ name: string; where: string }> = [
    { name: "organizations", where: `id = ${org}` },
    { name: "projects", where: `org_id = ${org}` },
    { name: "workspaces", where: `org_id = ${org}${wsById}` },
    { name: "state_versions", where: `org_id = ${org}${ws}` },
    { name: "providers", where: `org_id = ${org}${ws}` },
    { name: "modules", where: `org_id = ${org}${ws}` },
    { name: "resources", where: `org_id = ${org}${ws}` },
    { name: "resource_instances", where: `org_id = ${org}${ws}` },
    { name: "resource_attributes", where: `org_id = ${org}${ws}` },
    { name: "outputs", where: `org_id = ${org}${ws}` },
    { name: "dependencies", where: `org_id = ${org}${ws}` },
    { name: "change_events", where: `org_id = ${org}${ws}` },
    { name: "drift_events", where: `org_id = ${org}${ws}` }
  ];
  await client.query("SET LOCAL search_path = pg_temp, public");
  for (const view of views) {
    await client.query(`DROP VIEW IF EXISTS pg_temp.${ident(view.name)} CASCADE`);
    await client.query(`CREATE TEMP VIEW ${ident(view.name)} AS SELECT * FROM public.${ident(view.name)} WHERE ${view.where}`);
  }
}

async function auditQuery(pool: PgPool, input: ExecuteScopedSqlInput & { rowCount: number; elapsedMs: number; status: "success" | "blocked" | "error"; error?: string }): Promise<void> {
  await pool.query(
    `INSERT INTO query_audit_logs(id, org_id, user_id, api_token_id, sql, workspace_ids, row_count, elapsed_ms, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      `qal_${randomUUID()}`,
      input.orgId,
      input.userId ?? null,
      input.apiTokenId ?? null,
      input.sql,
      input.workspaceIds ?? [],
      input.rowCount,
      Math.trunc(input.elapsedMs),
      input.status,
      input.error ?? null
    ]
  );
}

export async function executeScopedSql(pool: PgPool, input: ExecuteScopedSqlInput): Promise<ExecuteScopedSqlResult> {
  const started = Date.now();
  const validation = validateReadOnlySql(input.sql);
  if (!validation.ok) {
    await auditQuery(pool, { ...input, rowCount: 0, elapsedMs: Date.now() - started, status: "blocked", error: validation.error });
    throw new Error(validation.error);
  }

  const limit = clampQueryLimit(input.limit, input.maxRows ?? 5_000);
  const timeoutMs = Math.max(100, Math.min(input.timeoutMs ?? 5_000, 60_000));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL statement_timeout = ${Math.trunc(timeoutMs)}`);
    await createScopedTempViews(client, input.orgId, input.workspaceIds);
    const result = await client.query(`SELECT * FROM (${validation.normalizedSql}) AS statebase_query LIMIT ${limit}`);
    await client.query("COMMIT");
    const elapsedMs = Date.now() - started;
    await auditQuery(pool, { ...input, rowCount: result.rowCount ?? result.rows.length, elapsedMs, status: "success" });
    return {
      columns: result.fields.map((field) => field.name),
      rows: result.rows,
      elapsedMs
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const elapsedMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    await auditQuery(pool, { ...input, rowCount: 0, elapsedMs, status: "error", error: message });
    throw error;
  } finally {
    client.release();
  }
}

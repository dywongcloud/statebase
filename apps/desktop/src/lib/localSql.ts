import alasql from "alasql";
import { clampQueryLimit, validateReadOnlySql } from "@statebase/core/browser";
import type { LocalDataset } from "./localNormalize";

export interface LocalSqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  elapsedMs: number;
}

export function runLocalSql(dataset: LocalDataset, sql: string, limit = 1000): LocalSqlResult {
  const started = performance.now();
  const validation = validateReadOnlySql(sql);
  if (!validation.ok) throw new Error(validation.error);
  const db = new (alasql as any).Database();
  for (const table of ["resources", "resource_instances", "resource_attributes", "outputs", "providers", "modules", "dependencies", "change_events"] as const) {
    db.exec(`CREATE TABLE ${table}`);
    db.tables[table].data = dataset[table];
  }
  const rows = db.exec(validation.normalizedSql) as Record<string, unknown>[];
  const limited = Array.isArray(rows) ? rows.slice(0, clampQueryLimit(limit, 5000)) : [];
  const columns = limited[0] ? Object.keys(limited[0]) : [];
  return { columns, rows: limited, elapsedMs: Math.round(performance.now() - started) };
}

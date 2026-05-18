import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTerraformState } from "@statebase/parser";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, executeScopedSql, insertParsedState, runMigrations } from "../src/index.js";

const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const maybeDescribe = connectionString ? describe : describe.skip;
const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");

maybeDescribe("database ingestion integration", () => {
  const pool = createPool({ connectionString });

  beforeAll(async () => {
    await runMigrations(connectionString);
    await pool.query("INSERT INTO organizations(id, name, slug) VALUES ('org_test', 'Test Org', 'test-org') ON CONFLICT (id) DO NOTHING");
    await pool.query("INSERT INTO projects(id, org_id, name, slug) VALUES ('proj_test', 'org_test', 'Test', 'test') ON CONFLICT (org_id, slug) DO NOTHING");
    await pool.query("INSERT INTO workspaces(id, org_id, project_id, name, slug) VALUES ('ws_test', 'org_test', 'proj_test', 'Test', 'test') ON CONFLICT (org_id, slug) DO NOTHING");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("creates state version, resources, attributes and redactions", async () => {
    const state = JSON.parse(readFileSync(path.join(fixturesDir, "sensitive-values.tfstate.json"), "utf8"));
    const summary = await insertParsedState(pool, { orgId: "org_test", workspaceId: "ws_test", source: "upload", parsed: parseTerraformState(state) });
    expect(summary.stateVersionId).toMatch(/^sv_/);
    expect(summary.resources).toBeGreaterThan(0);
    expect(summary.attributes).toBeGreaterThan(0);
    expect(summary.redactedAttributes).toBeGreaterThan(0);
  });

  it("blocks mutation SQL and executes SELECT with audit", async () => {
    await expect(executeScopedSql(pool, { orgId: "org_test", sql: "DROP TABLE resources" })).rejects.toThrow();
    const result = await executeScopedSql(pool, { orgId: "org_test", sql: "SELECT type, COUNT(*)::int AS count FROM resources GROUP BY type", limit: 10 });
    expect(result.columns).toContain("type");
    const audit = await pool.query("SELECT COUNT(*)::int AS count FROM query_audit_logs WHERE org_id = $1", ["org_test"]);
    expect(audit.rows[0].count).toBeGreaterThan(0);
  });
});

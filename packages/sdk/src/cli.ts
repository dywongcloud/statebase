#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parseTerraformState } from "@statebase/parser";
import { StateBaseClient } from "./index.js";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function requireArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const command = process.argv[2];
  const baseUrl = arg("--base-url", process.env.STATEBASE_BASE_URL ?? "http://localhost:4000")!;
  const token = arg("--token", process.env.STATEBASE_TOKEN);
  const client = new StateBaseClient({ baseUrl, token });

  if (command === "ingest") {
    const file = process.argv[3];
    if (!file) throw new Error("Usage: statebase ingest ./terraform.tfstate --org org_123 --workspace ws_123");
    const orgId = requireArg("--org");
    const workspaceId = requireArg("--workspace");
    const state = JSON.parse(await readFile(file, "utf8"));
    console.log(await client.ingest.tfstate({ orgId, workspaceId, source: "upload", state }));
    return;
  }

  if (command === "query") {
    const sql = process.argv[3];
    if (!sql) throw new Error("Usage: statebase query \"SELECT type, COUNT(*) FROM resources GROUP BY type\" --org org_123");
    const orgId = requireArg("--org");
    console.table((await client.query.sql({ orgId, sql })).rows);
    return;
  }

  if (command === "diff") {
    const orgId = requireArg("--org");
    const workspaceId = requireArg("--workspace");
    const events = await client.changeEvents.list({ orgId, workspaceId, pageSize: 100 }) as any;
    console.table(events.items ?? events);
    return;
  }

  if (command === "local") {
    const file = process.argv[3];
    if (!file) throw new Error("Usage: statebase local ./terraform.tfstate");
    const parsed = parseTerraformState(JSON.parse(await readFile(file, "utf8")));
    console.log(JSON.stringify({
      terraformVersion: parsed.metadata.terraformVersion,
      resources: parsed.resources.length,
      outputs: parsed.outputs.length,
      redactedAttributes: parsed.resources.flatMap((r) => r.instances).flatMap((i) => i.attributes).filter((a) => a.isSensitive).length
    }, null, 2));
    return;
  }

  console.log(`StateBase CLI

Commands:
  statebase ingest ./terraform.tfstate --org org_123 --workspace ws_123
  statebase query "SELECT type, COUNT(*) FROM resources GROUP BY type" --org org_123
  statebase diff --org org_123 --workspace ws_123
  statebase local ./terraform.tfstate`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

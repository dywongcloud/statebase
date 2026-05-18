import { hashApiToken } from "@statebase/core";
import { createPool } from "./client.js";

export async function seed(connectionString = process.env.DATABASE_URL): Promise<void> {
  const pool = createPool({ connectionString });
  const client = await pool.connect();
  const token = process.env.STATEBASE_DEMO_TOKEN ?? "sb_demo_local_dev_token_change_me";
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO organizations(id, name, slug) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name", ["org_demo", "StateBase Demo", "statebase-demo"]);
    await client.query("INSERT INTO users(id, email, name) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name", ["user_demo", "demo@statebase.local", "Demo Platform Engineer"]);
    await client.query("INSERT INTO memberships(id, org_id, user_id, role) VALUES ($1,$2,$3,$4) ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role", ["mem_demo", "org_demo", "user_demo", "owner"]);
    await client.query("INSERT INTO projects(id, org_id, name, slug) VALUES ($1,$2,$3,$4) ON CONFLICT (org_id, slug) DO UPDATE SET name = EXCLUDED.name", ["proj_demo", "org_demo", "Demo Project", "demo-project"]);
    await client.query(
      `INSERT INTO workspaces(id, org_id, project_id, name, slug, environment, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (org_id, slug) DO UPDATE SET name = EXCLUDED.name, environment = EXCLUDED.environment, description = EXCLUDED.description`,
      ["ws_demo", "org_demo", "proj_demo", "Production", "production", "prod", "Seeded demo workspace"]
    );
    await client.query(
      `INSERT INTO api_tokens(id, org_id, user_id, name, token_prefix, token_hash, scopes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (token_hash) DO UPDATE SET scopes = EXCLUDED.scopes, revoked_at = NULL`,
      [
        "tok_demo",
        "org_demo",
        "user_demo",
        "Local development token",
        token.slice(0, 16),
        hashApiToken(token),
        ["state:read", "state:write", "query:read", "query:execute", "workspace:admin", "org:admin"]
      ]
    );
    await client.query("COMMIT");
    console.log("Seed complete");
    console.log("Demo org: org_demo");
    console.log("Demo workspace: ws_demo");
    console.log(`Demo API token: ${token}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

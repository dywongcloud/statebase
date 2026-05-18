import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "./client.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(dirname, "../migrations");

export async function runMigrations(connectionString = process.env.DATABASE_URL): Promise<void> {
  const pool = createPool({ connectionString });
  const client = await pool.connect();
  try {
    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
    await client.query("BEGIN");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const already = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (already.rowCount) continue;
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
      console.log(`Applied migration ${version}`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

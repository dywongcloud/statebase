import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

export interface DbClientOptions {
  connectionString?: string;
  max?: number;
}

export function createPool(options: DbClientOptions = {}): pg.Pool {
  const connectionString = options.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({ connectionString, max: options.max ?? 10 });
}

export function createDrizzle(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type PgPool = pg.Pool;
export type PgClient = pg.PoolClient;

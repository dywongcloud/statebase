import { hashApiToken } from "@statebase/core";
import type { PgPool } from "./client.js";

export interface AuthenticatedApiToken {
  id: string;
  orgId: string;
  userId?: string | null;
  name: string;
  scopes: string[];
}

export async function authenticateApiToken(pool: PgPool, token: string): Promise<AuthenticatedApiToken | null> {
  const hash = hashApiToken(token);
  const result = await pool.query(
    `SELECT id, org_id, user_id, name, scopes
     FROM api_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())`,
    [hash]
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  await pool.query("UPDATE api_tokens SET last_used_at = now() WHERE id = $1", [row.id]);
  return { id: row.id, orgId: row.org_id, userId: row.user_id, name: row.name, scopes: row.scopes ?? [] };
}

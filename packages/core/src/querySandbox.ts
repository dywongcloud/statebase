export const BLOCKED_SQL_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "COPY",
  "CALL",
  "EXECUTE",
  "MERGE",
  "VACUUM",
  "ANALYZE",
  "REFRESH",
  "LISTEN",
  "NOTIFY"
] as const;

const RESTRICTED_IDENTIFIERS = [
  "api_tokens",
  "token_hash",
  "users",
  "memberships",
  "query_audit_logs",
  "connectors",
  "pg_catalog",
  "information_schema",
  "pg_",
  "public.",
  "\"public\"",
  "statebase.",
  "current_setting",
  "set_config",
  "pg_sleep",
  "dblink",
  "lo_import",
  "lo_export"
] as const;

export interface SqlValidationResult {
  ok: boolean;
  normalizedSql?: string;
  error?: string;
}

function stripStringLiterals(sql: string): string {
  return sql
    .replace(/'([^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, "$$$$")
    .replace(/"([^"\\]|\\.)*"/g, '""');
}

export function validateReadOnlySql(sql: string): SqlValidationResult {
  const normalizedSql = sql.trim();
  if (!normalizedSql) return { ok: false, error: "SQL is required" };
  if (normalizedSql.length > 50_000) return { ok: false, error: "SQL exceeds the maximum length" };
  if (normalizedSql.includes(";")) return { ok: false, error: "Only one SELECT statement is allowed; semicolons are not accepted" };
  if (/--|\/\*/.test(normalizedSql)) return { ok: false, error: "SQL comments are not accepted in the query API" };

  const rawIdentifierScan = normalizedSql.toLowerCase().replace(/"/g, "");
  for (const identifier of RESTRICTED_IDENTIFIERS) {
    const normalizedIdentifier = identifier.toLowerCase().replace(/"/g, "");
    if (rawIdentifierScan.includes(normalizedIdentifier)) {
      return { ok: false, error: `Restricted identifier is not allowed: ${identifier}` };
    }
  }

  const withoutStrings = stripStringLiterals(normalizedSql);
  if (!/^\s*(select|with)\b/i.test(withoutStrings)) {
    return { ok: false, error: "Only read-only SELECT queries are allowed" };
  }

  for (const keyword of BLOCKED_SQL_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(withoutStrings)) return { ok: false, error: `Blocked SQL keyword: ${keyword}` };
  }

  const lowered = withoutStrings.toLowerCase();
  for (const identifier of RESTRICTED_IDENTIFIERS) {
    if (lowered.includes(identifier.toLowerCase())) {
      return { ok: false, error: `Restricted identifier is not allowed: ${identifier}` };
    }
  }

  return { ok: true, normalizedSql };
}

export function clampQueryLimit(requested: unknown, maxRows = 5_000): number {
  const parsed = typeof requested === "number" ? requested : Number(requested ?? 1_000);
  if (!Number.isFinite(parsed)) return 1_000;
  return Math.max(1, Math.min(Math.trunc(parsed), maxRows));
}

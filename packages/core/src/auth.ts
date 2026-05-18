import { createHash, randomBytes } from "node:crypto";

export type ApiTokenScope =
  | "state:read"
  | "state:write"
  | "query:read"
  | "query:execute"
  | "workspace:admin"
  | "org:admin";

export const ALL_TOKEN_SCOPES: ApiTokenScope[] = [
  "state:read",
  "state:write",
  "query:read",
  "query:execute",
  "workspace:admin",
  "org:admin"
];

export interface GeneratedApiToken {
  token: string;
  prefix: string;
  hash: string;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateApiToken(): GeneratedApiToken {
  const publicPart = randomBytes(6).toString("base64url");
  const secretPart = randomBytes(32).toString("base64url");
  const token = `sb_${publicPart}_${secretPart}`;
  return { token, prefix: `sb_${publicPart}`, hash: hashApiToken(token) };
}

export function hasRequiredScopes(actual: string[], required: string[]): boolean {
  if (actual.includes("org:admin")) return true;
  return required.every((scope) => actual.includes(scope));
}

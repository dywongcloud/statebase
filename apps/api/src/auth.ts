import { hasRequiredScopes } from "@statebase/core";
import { authenticateApiToken } from "@statebase/db";
import type { FastifyReply, FastifyRequest } from "fastify";

const PUBLIC_PATHS = ["/health", "/docs", "/openapi.json"];

function isPublicPath(url: string): boolean {
  return PUBLIC_PATHS.some((path) => url === path || url.startsWith(`${path}/`));
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method === "OPTIONS" || isPublicPath(request.url)) return;
  const token = bearerToken(request);
  if (!token) {
    await reply.code(401).send({ error: "unauthorized", message: "Bearer API token is required" });
    return;
  }
  const auth = await authenticateApiToken(request.server.db, token);
  if (!auth) {
    await reply.code(401).send({ error: "unauthorized", message: "Invalid or expired API token" });
    return;
  }
  request.auth = auth;
}

export async function requireOrg(request: FastifyRequest, reply: FastifyReply, orgId: string, scopes: string[] = []): Promise<boolean> {
  const auth = request.auth;
  if (!auth) {
    await reply.code(401).send({ error: "unauthorized", message: "API token authentication failed" });
    return false;
  }
  if (auth.orgId !== orgId) {
    await reply.code(403).send({ error: "forbidden", message: "API token does not belong to this organization" });
    return false;
  }
  if (!hasRequiredScopes(auth.scopes, scopes)) {
    await reply.code(403).send({ error: "forbidden", message: `Missing required scope: ${scopes.join(", ")}` });
    return false;
  }
  return true;
}

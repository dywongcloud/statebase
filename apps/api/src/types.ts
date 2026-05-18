import type { AuthenticatedApiToken, PgPool } from "@statebase/db";
import type { ApiConfig } from "./config.js";

declare module "fastify" {
  interface FastifyInstance {
    db: PgPool;
    config: ApiConfig;
  }

  interface FastifyRequest {
    auth?: AuthenticatedApiToken;
  }
}

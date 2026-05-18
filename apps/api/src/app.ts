import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { createPool } from "@statebase/db";
import Fastify from "fastify";
import { authHook } from "./auth.js";
import { loadConfig, type ApiConfig } from "./config.js";
import { registerRoutes } from "./routes.js";
import "./types.js";

export async function buildApp(config: ApiConfig = loadConfig()) {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });
  app.decorate("config", config);
  app.decorate("db", createPool({ connectionString: config.DATABASE_URL }));

  await app.register(cors, {
    origin: config.CORS_ORIGIN ? config.CORS_ORIGIN.split(",") : true,
    credentials: true
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: "StateBase API",
        description: "Secure Terraform state ingestion, SQL querying, versioning, diffing, and drift intelligence API.",
        version: "0.1.0"
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "StateBase API token"
          }
        }
      },
      security: [{ bearerAuth: [] }]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true
    }
  });

  app.addHook("preHandler", authHook);
  await registerRoutes(app);

  app.addHook("onClose", async (instance) => {
    await instance.db.end();
  });

  return app;
}

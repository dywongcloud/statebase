import { parseTerraformState, TerraformStateParseError } from "@statebase/parser";
import { AwsInventoryProvider, AzureInventoryProvider, GcpInventoryProvider, KubernetesInventoryProvider } from "@statebase/core";
import {
  createWorkspace,
  executeScopedSql,
  getResourceDetail,
  getStateVersion,
  getWorkspace,
  insertParsedState,
  listRows,
  type ListTableName
} from "@statebase/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireOrg } from "./auth.js";
import {
  CreateWorkspaceSchema,
  IngestTfstateSchema,
  ListQuerySchema,
  OrgParamsSchema,
  ResourceParamsSchema,
  SqlQuerySchema,
  StateVersionParamsSchema,
  WorkspaceParamsSchema,
  responseSchemas,
  zodError
} from "./schemas.js";

function sendError(reply: FastifyReply, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  return reply.code(status).send({ error: status >= 500 ? "internal_error" : "bad_request", message });
}

function listEndpoint(app: FastifyInstance, path: string, table: ListTableName) {
  app.get(path, {
    schema: {
      tags: ["REST"],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "integer", minimum: 1 },
          pageSize: { type: "integer", minimum: 1, maximum: 250 },
          workspaceId: { type: "string" },
          stateVersionId: { type: "string" },
          search: { type: "string" },
          sortBy: { type: "string" },
          sortDir: { type: "string", enum: ["asc", "desc"] },
          type: { type: "string" },
          provider: { type: "string" },
          module: { type: "string" },
          environment: { type: "string" },
          severity: { type: "string" }
        }
      },
      response: { 200: responseSchemas.paged, 400: responseSchemas.error, 401: responseSchemas.error, 403: responseSchemas.error }
    }
  }, async (request, reply) => {
    try {
      const params = OrgParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const query = ListQuerySchema.parse(request.query);
      return listRows(app.db, table, params.orgId, query);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", { schema: { tags: ["System"], response: { 200: { type: "object", properties: { ok: { type: "boolean" } } } } } }, async () => ({ ok: true }));
  app.get("/openapi.json", { schema: { hide: true } }, async () => app.swagger());

  app.post("/api/v1/orgs/:orgId/workspaces", {
    schema: {
      tags: ["Workspaces"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          slug: { type: "string" },
          projectId: { type: "string" },
          projectName: { type: "string" },
          environment: { type: "string" },
          description: { type: "string" }
        }
      },
      response: { 200: { type: "object", additionalProperties: true }, 400: responseSchemas.error, 403: responseSchemas.error }
    }
  }, async (request, reply) => {
    try {
      const params = OrgParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["workspace:admin"]))) return;
      const body = CreateWorkspaceSchema.parse(request.body);
      return createWorkspace(app.db, { orgId: params.orgId, ...body });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  listEndpoint(app, "/api/v1/orgs/:orgId/workspaces", "workspaces");

  app.get("/api/v1/orgs/:orgId/workspaces/:workspaceId", { schema: { tags: ["Workspaces"], security: [{ bearerAuth: [] }], response: { 200: { type: "object", additionalProperties: true }, 404: responseSchemas.error } } }, async (request, reply) => {
    try {
      const params = WorkspaceParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const workspace = await getWorkspace(app.db, params.orgId, params.workspaceId);
      if (!workspace) return reply.code(404).send({ error: "not_found", message: "Workspace not found" });
      return workspace;
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  app.get("/api/v1/orgs/:orgId/workspaces/:workspaceId/state-versions", { schema: { tags: ["State Versions"], security: [{ bearerAuth: [] }], response: { 200: responseSchemas.paged } } }, async (request, reply) => {
    try {
      const params = WorkspaceParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const query = ListQuerySchema.parse({ ...request.query, workspaceId: params.workspaceId });
      return listRows(app.db, "state_versions", params.orgId, query);
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  app.get("/api/v1/orgs/:orgId/state-versions/:stateVersionId", { schema: { tags: ["State Versions"], security: [{ bearerAuth: [] }], response: { 200: { type: "object", additionalProperties: true }, 404: responseSchemas.error } } }, async (request, reply) => {
    try {
      const params = StateVersionParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const stateVersion = await getStateVersion(app.db, params.orgId, params.stateVersionId);
      if (!stateVersion) return reply.code(404).send({ error: "not_found", message: "State version not found" });
      return stateVersion;
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  listEndpoint(app, "/api/v1/orgs/:orgId/resources", "resources");
  listEndpoint(app, "/api/v1/orgs/:orgId/modules", "modules");
  listEndpoint(app, "/api/v1/orgs/:orgId/providers", "providers");
  listEndpoint(app, "/api/v1/orgs/:orgId/outputs", "outputs");
  listEndpoint(app, "/api/v1/orgs/:orgId/dependencies", "dependencies");
  listEndpoint(app, "/api/v1/orgs/:orgId/change-events", "change_events");
  listEndpoint(app, "/api/v1/orgs/:orgId/drift-events", "drift_events");

  app.post("/api/v1/orgs/:orgId/workspaces/:workspaceId/drift/check", {
    schema: {
      tags: ["Drift"],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            status: { type: "string" },
            providers: { type: "array", items: { type: "object", additionalProperties: true } },
            message: { type: "string" }
          }
        },
        403: responseSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const params = WorkspaceParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const providers = [new AwsInventoryProvider(), new AzureInventoryProvider(), new GcpInventoryProvider(), new KubernetesInventoryProvider()]
        .map((provider) => ({ name: provider.name, configured: provider.isConfigured() }));
      return {
        status: providers.some((provider) => provider.configured) ? "configured_not_implemented" : "not_configured",
        providers,
        message: "Provider drift collection is intentionally stubbed in the MVP; no live cloud calls were made."
      };
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });


  app.get("/api/v1/orgs/:orgId/resources/:resourceId", { schema: { tags: ["REST"], security: [{ bearerAuth: [] }], response: { 200: { type: "object", additionalProperties: true }, 404: responseSchemas.error } } }, async (request, reply) => {
    try {
      const params = ResourceParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:read"]))) return;
      const resource = await getResourceDetail(app.db, params.orgId, params.resourceId);
      if (!resource) return reply.code(404).send({ error: "not_found", message: "Resource not found" });
      return resource;
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  app.post("/api/v1/orgs/:orgId/workspaces/:workspaceId/ingest/tfstate", {
    schema: {
      tags: ["Ingestion"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["source", "state"],
        properties: {
          source: { type: "string", enum: ["upload", "ci", "s3", "terraform-cloud", "local"] },
          state: { type: "object", additionalProperties: true },
          metadata: { type: "object", additionalProperties: true }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            stateVersionId: { type: "string" },
            resources: { type: "number" },
            attributes: { type: "number" },
            outputs: { type: "number" },
            redactedAttributes: { type: "number" },
            changeEvents: { type: "number" }
          }
        },
        400: responseSchemas.error,
        403: responseSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const params = WorkspaceParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["state:write"]))) return;
      const body = IngestTfstateSchema.parse(request.body);
      const parsed = parseTerraformState(body.state);
      return insertParsedState(app.db, { orgId: params.orgId, workspaceId: params.workspaceId, source: body.source, metadata: body.metadata, parsed });
    } catch (error) {
      if (error instanceof TerraformStateParseError) return reply.code(400).send({ error: "invalid_tfstate", message: error.message, issues: error.issues });
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error);
    }
  });

  app.post("/api/v1/orgs/:orgId/query/sql", {
    schema: {
      tags: ["SQL"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["sql"],
        properties: {
          sql: { type: "string", examples: ["SELECT type, COUNT(*) FROM resources GROUP BY type"] },
          workspaceIds: { type: "array", items: { type: "string" } },
          limit: { type: "integer", minimum: 1, maximum: 5000 }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            columns: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "object", additionalProperties: true } },
            elapsedMs: { type: "number" }
          }
        },
        400: responseSchemas.error,
        403: responseSchemas.error
      }
    }
  }, async (request, reply) => {
    try {
      const params = OrgParamsSchema.parse(request.params);
      if (!(await requireOrg(request, reply, params.orgId, ["query:execute"]))) return;
      const body = SqlQuerySchema.parse(request.body);
      return executeScopedSql(app.db, {
        orgId: params.orgId,
        userId: request.auth?.userId,
        apiTokenId: request.auth?.id,
        sql: body.sql,
        workspaceIds: body.workspaceIds,
        limit: body.limit,
        timeoutMs: app.config.QUERY_TIMEOUT_MS,
        maxRows: app.config.QUERY_MAX_ROWS
      });
    } catch (error) {
      if (error instanceof Error && error.name === "ZodError") return reply.code(400).send(zodError(error));
      return sendError(reply, error, 400);
    }
  });
}

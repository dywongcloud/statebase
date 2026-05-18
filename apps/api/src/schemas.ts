import { z } from "zod";

export const OrgParamsSchema = z.object({ orgId: z.string().min(1) });
export const WorkspaceParamsSchema = z.object({ orgId: z.string().min(1), workspaceId: z.string().min(1) });
export const StateVersionParamsSchema = z.object({ orgId: z.string().min(1), stateVersionId: z.string().min(1) });
export const ResourceParamsSchema = z.object({ orgId: z.string().min(1), resourceId: z.string().min(1) });

export const ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(250).default(50),
  workspaceId: z.string().optional(),
  stateVersionId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  type: z.string().optional(),
  provider: z.string().optional(),
  module: z.string().optional(),
  environment: z.string().optional(),
  severity: z.string().optional()
});

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  projectId: z.string().optional(),
  projectName: z.string().optional(),
  environment: z.string().optional(),
  description: z.string().optional()
});

export const IngestTfstateSchema = z.object({
  source: z.enum(["upload", "ci", "s3", "terraform-cloud", "local"]),
  state: z.unknown(),
  metadata: z.record(z.unknown()).optional().default({})
});

export const SqlQuerySchema = z.object({
  sql: z.string().min(1),
  workspaceIds: z.array(z.string()).optional().default([]),
  limit: z.coerce.number().int().positive().max(5000).optional().default(1000)
});

export function zodError(error: unknown) {
  if (error instanceof z.ZodError) return { error: "bad_request", message: "Validation failed", issues: error.issues };
  return { error: "bad_request", message: error instanceof Error ? error.message : String(error) };
}

export const responseSchemas = {
  paged: {
    type: "object",
    properties: {
      items: { type: "array", items: { type: "object", additionalProperties: true } },
      page: { type: "number" },
      pageSize: { type: "number" },
      total: { type: "number" }
    }
  },
  error: {
    type: "object",
    properties: {
      error: { type: "string" },
      message: { type: "string" },
      issues: { type: "array", items: { type: "object", additionalProperties: true } }
    }
  }
} as const;

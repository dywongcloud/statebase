import { z } from "zod";

export const TerraformOutputSchema = z
  .object({
    value: z.unknown().optional(),
    type: z.unknown().optional(),
    sensitive: z.boolean().optional()
  })
  .passthrough();

export const TerraformResourceInstanceSchema = z
  .object({
    index_key: z.union([z.string(), z.number()]).optional(),
    schema_version: z.number().int().optional(),
    attributes: z.record(z.unknown()).optional().default({}),
    sensitive_attributes: z.array(z.unknown()).optional().default([]),
    dependencies: z.array(z.string()).optional().default([])
  })
  .passthrough();

export const TerraformResourceSchema = z
  .object({
    mode: z.enum(["managed", "data"]),
    type: z.string().min(1),
    name: z.string().min(1),
    provider: z.string().optional(),
    module: z.string().optional(),
    instances: z.array(TerraformResourceInstanceSchema).optional().default([])
  })
  .passthrough();

export const TerraformStateSchema = z
  .object({
    version: z.literal(4),
    terraform_version: z.string().optional(),
    serial: z.number().int(),
    lineage: z.string().min(1),
    outputs: z.record(TerraformOutputSchema).optional().default({}),
    resources: z.array(TerraformResourceSchema).optional().default([])
  })
  .passthrough();

export type TerraformStateInput = z.infer<typeof TerraformStateSchema>;

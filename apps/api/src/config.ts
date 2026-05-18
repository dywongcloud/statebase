import { z } from "zod";

const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.string().default("info"),
  CORS_ORIGIN: z.string().optional(),
  QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  QUERY_MAX_ROWS: z.coerce.number().int().positive().default(5000)
});

export type ApiConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(): ApiConfig {
  return ConfigSchema.parse(process.env);
}

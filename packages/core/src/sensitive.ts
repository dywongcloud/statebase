import { REDACTED_DISPLAY_VALUE, REDACTED_VALUE, displayJsonValue, toJsonValue } from "./json.js";
import type { JsonValue } from "./types.js";

export const DEFAULT_SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "passwd",
  "secret",
  "token",
  "private_key",
  "private-key",
  "access_key",
  "secret_key",
  "client_secret",
  "connection_string",
  "certificate",
  "kubeconfig",
  "api_key",
  "apikey",
  "auth",
  "credential"
] as const;

const VALUE_SECRET_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "private_key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { name: "aws_access_key", regex: /\b(A3T[A-Z0-9]|AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: "jwt", regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { name: "github_token", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { name: "slack_token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { name: "connection_string_password", regex: /(password|pwd)=([^;\s]{4,})/i },
  { name: "basic_auth_url", regex: /[a-z]+:\/\/[^:\s]+:[^@\s]+@/i },
  { name: "kubeconfig", regex: /apiVersion:\s*v1[\s\S]{0,200}kind:\s*Config/i }
];

const PROVIDER_SENSITIVE_FIELDS: Record<string, string[]> = {
  aws: ["secret_access_key", "session_token", "access_key", "password", "private_key"],
  azurerm: ["client_secret", "client_certificate_password", "password", "certificate"],
  google: ["private_key", "client_secret", "access_token"],
  kubernetes: ["token", "client_key", "client_certificate", "password", "kubeconfig"],
  helm: ["repository_password", "password", "token"],
  github: ["token", "app_auth", "private_key"],
  postgresql: ["password", "connection_string"],
  mysql: ["password", "connection_string"]
};

export interface SensitiveDetectionInput {
  keyPath: string;
  value: unknown;
  providerName?: string;
  resourceType?: string;
  terraformSensitive?: boolean;
}

export interface SensitiveDetectionResult {
  isSensitive: boolean;
  reason?: string;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s.\[\]"']/g, "_").replace(/__+/g, "_");
}

export function detectSensitive(input: SensitiveDetectionInput): SensitiveDetectionResult {
  if (input.terraformSensitive) return { isSensitive: true, reason: "terraform_sensitive_flag" };

  const normalizedKey = normalizeKey(input.keyPath);
  for (const term of DEFAULT_SENSITIVE_KEY_SUBSTRINGS) {
    const normalizedTerm = normalizeKey(term);
    if (normalizedKey.includes(normalizedTerm)) return { isSensitive: true, reason: `key_contains_${term}` };
  }

  if (input.providerName) {
    const providerTerms = PROVIDER_SENSITIVE_FIELDS[input.providerName.toLowerCase()] ?? [];
    for (const term of providerTerms) {
      if (normalizedKey.includes(normalizeKey(term))) return { isSensitive: true, reason: `provider_${input.providerName}_${term}` };
    }
  }

  if (typeof input.value === "string") {
    for (const pattern of VALUE_SECRET_PATTERNS) {
      if (pattern.regex.test(input.value)) return { isSensitive: true, reason: `value_matches_${pattern.name}` };
    }
  }

  return { isSensitive: false };
}

export function sanitizeForStorage(value: unknown, isSensitive: boolean): JsonValue {
  if (isSensitive) return REDACTED_VALUE;
  return toJsonValue(value);
}

export function displayValueForApi(value: unknown, isSensitive: boolean): string {
  if (isSensitive) return REDACTED_DISPLAY_VALUE;
  return displayJsonValue(value);
}

export function summarizeRedaction(value: unknown): string {
  if (value === REDACTED_VALUE) return REDACTED_DISPLAY_VALUE;
  return displayJsonValue(value);
}

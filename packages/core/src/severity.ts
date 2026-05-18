import { stableStringify } from "./json.js";
import type { JsonValue, Severity } from "./types.js";

export interface SeverityInput {
  resourceAddress?: string;
  resourceType?: string;
  keyPath?: string;
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

export interface SeverityResult {
  severity: Severity;
  summary: string;
}

function lower(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}

function includesPublicCidr(value: unknown): boolean {
  const encoded = stableStringify(value);
  return encoded.includes("0.0.0.0/0") || encoded.includes("::/0");
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

export function classifyAttributeChange(input: SeverityInput): SeverityResult {
  const keyPath = lower(input.keyPath);
  const resourceType = lower(input.resourceType ?? input.resourceAddress);
  const newBool = asBoolean(input.newValue);
  const oldBool = asBoolean(input.oldValue);

  if ((keyPath.includes("cidr") || keyPath.includes("ingress") || resourceType.includes("security_group")) && includesPublicCidr(input.newValue)) {
    return { severity: "high", summary: "Security boundary changed to allow public ingress" };
  }

  if (keyPath.includes("publicly_accessible") && oldBool === false && newBool === true) {
    return { severity: "high", summary: "Database or managed service became publicly accessible" };
  }

  if ((keyPath.includes("storage_encrypted") || keyPath.includes("encrypted") || keyPath.includes("encryption")) && newBool === false) {
    return { severity: "high", summary: "Encryption appears to have been disabled" };
  }

  if ((keyPath.includes("deletion_protection") || keyPath.includes("delete_protection")) && newBool === false) {
    return { severity: "high", summary: "Deletion protection appears to have been disabled" };
  }

  if (keyPath.includes("backup_retention")) {
    const oldNumber = asNumber(input.oldValue);
    const newNumber = asNumber(input.newValue);
    if (oldNumber !== undefined && newNumber !== undefined && newNumber < oldNumber) {
      return { severity: "medium", summary: "Backup retention was reduced" };
    }
  }

  if (resourceType.includes("iam") || keyPath.includes("policy")) {
    return { severity: "medium", summary: "IAM or policy document changed" };
  }

  if (keyPath.includes("acl") && stableStringify(input.newValue).toLowerCase().includes("public")) {
    return { severity: "high", summary: "Public access control setting detected" };
  }

  if (keyPath.includes("sensitive") || keyPath.includes("secret") || keyPath.includes("password")) {
    return { severity: "medium", summary: "Sensitive field changed" };
  }

  return { severity: "low", summary: "Infrastructure attribute changed" };
}

export function severityForResourceLifecycle(kind: "added" | "removed", resourceType?: string): SeverityResult {
  const type = lower(resourceType);
  if (type.includes("security_group") || type.includes("iam") || type.includes("policy")) {
    return { severity: "medium", summary: `Security-sensitive resource ${kind}` };
  }
  if (type.includes("db") || type.includes("database") || type.includes("rds")) {
    return { severity: "medium", summary: `Data-plane resource ${kind}` };
  }
  return { severity: "info", summary: `Resource ${kind}` };
}

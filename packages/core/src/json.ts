import type { JsonValue } from "./types.js";

export const REDACTED_VALUE = "__STATEBASE_REDACTED__";
export const REDACTED_DISPLAY_VALUE = "[REDACTED]";

export function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

export function toJsonValue(value: unknown): JsonValue {
  if (isJsonValue(value)) return value;
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return null;
  try {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  } catch {
    return String(value);
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`).join(",")}}`;
}

export function displayJsonValue(value: unknown, maxLength = 240): string {
  if (value === REDACTED_VALUE) return REDACTED_DISPLAY_VALUE;
  let display: string;
  if (typeof value === "string") display = value;
  else if (value === null || typeof value === "number" || typeof value === "boolean") display = String(value);
  else display = JSON.stringify(value);
  if (display.length > maxLength) return `${display.slice(0, maxLength)}…`;
  return display;
}

export function deepCloneJson<T extends JsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function parseKeyPath(path: string): Array<string | number> {
  const parts: Array<string | number> = [];
  let current = "";
  for (let i = 0; i < path.length; i += 1) {
    const char = path[i];
    if (char === ".") {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }
    if (char === "[") {
      if (current) {
        parts.push(current);
        current = "";
      }
      const end = path.indexOf("]", i);
      if (end === -1) {
        current += char;
        continue;
      }
      const raw = path.slice(i + 1, end);
      const unquoted = raw.replace(/^['\"]|['\"]$/g, "");
      const asNumber = Number(unquoted);
      parts.push(Number.isInteger(asNumber) && raw.trim() !== "" && !Number.isNaN(asNumber) ? asNumber : unquoted);
      i = end;
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  return parts;
}

export function setJsonPath(root: JsonValue, keyPath: string, value: JsonValue): JsonValue {
  const parts = parseKeyPath(keyPath);
  if (parts.length === 0) return value;
  let cursor: any = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor = cursor?.[parts[index] as any];
    if (cursor === undefined || cursor === null) return root;
  }
  cursor[parts[parts.length - 1] as any] = value;
  return root;
}

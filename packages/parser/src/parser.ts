import {
  REDACTED_VALUE,
  detectSensitive,
  displayValueForApi,
  sanitizeForStorage,
  setJsonPath,
  toJsonValue,
  valueType,
  type JsonValue,
  type ParsedAttribute,
  type ParsedDependency,
  type ParsedModule,
  type ParsedOutput,
  type ParsedProvider,
  type ParsedResource,
  type ParsedResourceInstance,
  type ParsedState,
  type ResourceMode
} from "@statebase/core/browser";
import { TerraformStateSchema, type TerraformStateInput } from "./schema.js";

export class TerraformStateParseError extends Error {
  constructor(message: string, public issues: unknown[] = []) {
    super(message);
    this.name = "TerraformStateParseError";
  }
}

function parseRawState(input: unknown): TerraformStateInput {
  let decoded = input;
  if (typeof input === "string") {
    try {
      decoded = JSON.parse(input) as unknown;
    } catch (error) {
      throw new TerraformStateParseError("Terraform state is not valid JSON", [error]);
    }
  }
  const parsed = TerraformStateSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new TerraformStateParseError("Terraform state failed validation", parsed.error.issues);
  }
  return parsed.data;
}

function providerFromReference(reference?: string): ParsedProvider | undefined {
  if (!reference) return undefined;
  const match = reference.match(/provider\["([^"\]]+)"\](?:\.(.+))?/);
  const source = match?.[1] ?? reference;
  const alias = match?.[2];
  const name = source.split("/").pop()?.replace(/[^A-Za-z0-9_-]/g, "") || source;
  return {
    address: reference,
    source,
    name,
    alias
  };
}

function modulePrefixes(moduleAddress?: string): ParsedModule[] {
  const root: ParsedModule = { address: "root", path: [], parentAddress: undefined };
  if (!moduleAddress) return [root];
  const matches = moduleAddress.match(/module\.[^.]+/g) ?? [];
  const modules: ParsedModule[] = [root];
  const path: string[] = [];
  for (const segment of matches) {
    path.push(segment);
    const address = path.join(".");
    modules.push({ address, path: [...path], parentAddress: path.length > 1 ? path.slice(0, -1).join(".") : "root" });
  }
  return modules;
}

function resourceAddress(moduleAddress: string | undefined, mode: ResourceMode, type: string, name: string): string {
  const base = mode === "data" ? `data.${type}.${name}` : `${type}.${name}`;
  return moduleAddress ? `${moduleAddress}.${base}` : base;
}

function instanceAddress(baseAddress: string, indexKey: string | number | undefined): string {
  if (indexKey === undefined) return baseAddress;
  if (typeof indexKey === "number") return `${baseAddress}[${indexKey}]`;
  return `${baseAddress}[${JSON.stringify(indexKey)}]`;
}

function sensitivePathToKeyPath(path: unknown): string | undefined {
  if (typeof path === "string") return path;
  if (!Array.isArray(path)) return undefined;
  let result = "";
  for (const part of path) {
    if (typeof part === "number") {
      result += `[${part}]`;
    } else if (typeof part === "string") {
      result += result ? `.${part}` : part;
    }
  }
  return result || undefined;
}

function normalizeSensitivePaths(paths: unknown[]): string[] {
  return paths.map(sensitivePathToKeyPath).filter((value): value is string => Boolean(value));
}

function keyPathMatchesSensitiveFlag(keyPath: string, sensitivePaths: string[]): boolean {
  return sensitivePaths.some((sensitivePath) => keyPath === sensitivePath || keyPath.startsWith(`${sensitivePath}.`) || keyPath.startsWith(`${sensitivePath}[`));
}

interface NormalizedAttributesResult {
  attributesJson: JsonValue;
  attributes: ParsedAttribute[];
  redactedPaths: string[];
}

function normalizeAttributes(input: {
  rawAttributes: Record<string, unknown>;
  providerName?: string;
  resourceType: string;
  resourceAddress: string;
  instanceAddress: string;
  terraformSensitivePaths: string[];
}): NormalizedAttributesResult {
  const sanitizedRoot = toJsonValue(input.rawAttributes);
  const attributes: ParsedAttribute[] = [];
  const redactedPaths: string[] = [];

  function visit(value: unknown, keyPath: string): JsonValue {
    const jsonValue = toJsonValue(value);
    if (Array.isArray(jsonValue)) {
      if (jsonValue.length === 0 && keyPath) {
        return recordLeaf(jsonValue, keyPath);
      }
      return jsonValue.map((item, index) => visit(item, `${keyPath}[${index}]`));
    }

    if (jsonValue !== null && typeof jsonValue === "object") {
      const entries = Object.entries(jsonValue);
      if (entries.length === 0 && keyPath) {
        return recordLeaf(jsonValue, keyPath);
      }
      const result: Record<string, JsonValue> = {};
      for (const [key, childValue] of entries) {
        const childPath = keyPath ? `${keyPath}.${key}` : key;
        result[key] = visit(childValue, childPath);
      }
      return result;
    }

    return recordLeaf(jsonValue, keyPath);
  }

  function recordLeaf(value: JsonValue, keyPath: string): JsonValue {
    const terraformSensitive = keyPathMatchesSensitiveFlag(keyPath, input.terraformSensitivePaths);
    const detection = detectSensitive({
      keyPath,
      value,
      providerName: input.providerName,
      resourceType: input.resourceType,
      terraformSensitive
    });
    const sanitizedValue = sanitizeForStorage(value, detection.isSensitive);
    if (detection.isSensitive) redactedPaths.push(keyPath);
    attributes.push({
      resourceAddress: input.resourceAddress,
      instanceAddress: input.instanceAddress,
      keyPath,
      value: sanitizedValue,
      valueType: valueType(value),
      displayValue: displayValueForApi(value, detection.isSensitive),
      isSensitive: detection.isSensitive,
      sensitiveReason: detection.reason
    });
    return sanitizedValue;
  }

  const attributesJson = visit(sanitizedRoot, "");
  for (const path of redactedPaths) setJsonPath(attributesJson, path, REDACTED_VALUE);
  return { attributesJson, attributes, redactedPaths };
}

function normalizeOutput(name: string, output: { value?: unknown; type?: unknown; sensitive?: boolean }): ParsedOutput {
  const value = output.value === undefined ? null : output.value;
  const detection = detectSensitive({ keyPath: name, value, terraformSensitive: output.sensitive === true });
  return {
    name,
    value: sanitizeForStorage(value, detection.isSensitive),
    type: output.type === undefined ? undefined : toJsonValue(output.type),
    displayValue: displayValueForApi(value, detection.isSensitive),
    isSensitive: detection.isSensitive,
    sensitiveReason: detection.reason
  };
}


function extractProviderVersions(state: Record<string, unknown>): Map<string, string> {
  const versions = new Map<string, string>();
  const providerConfigs = state.provider_configs;
  if (providerConfigs && typeof providerConfigs === "object" && !Array.isArray(providerConfigs)) {
    for (const config of Object.values(providerConfigs as Record<string, any>)) {
      const source = typeof config?.full_name === "string" ? config.full_name : typeof config?.name === "string" ? config.name : undefined;
      const version = typeof config?.version === "string" ? config.version : undefined;
      if (source && version) {
        versions.set(source, version);
        versions.set(source.split("/").pop() ?? source, version);
      }
    }
  }
  return versions;
}

function uniqueByAddress<T extends { address: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.address, item);
  return [...map.values()];
}

function buildDependencies(instanceAddr: string, dependencies: string[] | undefined): ParsedDependency[] {
  return (dependencies ?? []).map((targetAddress) => ({
    sourceAddress: instanceAddr,
    targetAddress,
    dependencyType: "explicit" as const
  }));
}

export function parseTerraformState(input: unknown): ParsedState {
  const state = parseRawState(input);
  const providers: ParsedProvider[] = [];
  const modules: ParsedModule[] = [{ address: "root", path: [], parentAddress: undefined }];
  const resources: ParsedResource[] = [];
  const dependencies: ParsedDependency[] = [];
  const warnings: string[] = [];

  for (const rawResource of state.resources ?? []) {
    const provider = providerFromReference(rawResource.provider);
    if (provider) providers.push(provider);
    modules.push(...modulePrefixes(rawResource.module));
    const address = resourceAddress(rawResource.module, rawResource.mode, rawResource.type, rawResource.name);
    const instances: ParsedResourceInstance[] = [];

    for (const rawInstance of rawResource.instances ?? []) {
      const instAddress = instanceAddress(address, rawInstance.index_key);
      const sensitivePaths = normalizeSensitivePaths(rawInstance.sensitive_attributes ?? []);
      const normalized = normalizeAttributes({
        rawAttributes: rawInstance.attributes ?? {},
        providerName: provider?.name,
        resourceType: rawResource.type,
        resourceAddress: address,
        instanceAddress: instAddress,
        terraformSensitivePaths: sensitivePaths
      });
      const instanceDependencies = buildDependencies(instAddress, rawInstance.dependencies);
      dependencies.push(...instanceDependencies);
      instances.push({
        address: instAddress,
        resourceAddress: address,
        indexKey: rawInstance.index_key,
        schemaVersion: rawInstance.schema_version,
        attributesJson: normalized.attributesJson,
        sensitivePaths: [...new Set([...sensitivePaths, ...normalized.redactedPaths])],
        attributes: normalized.attributes,
        dependencies: instanceDependencies
      });
    }

    if ((rawResource.instances ?? []).length === 0) warnings.push(`Resource ${address} has no instances`);
    resources.push({
      mode: rawResource.mode,
      type: rawResource.type,
      name: rawResource.name,
      address,
      moduleAddress: rawResource.module,
      providerAddress: provider?.address,
      providerName: provider?.name,
      instances
    });
  }

  const outputs: ParsedOutput[] = Object.entries(state.outputs ?? {}).map(([name, output]) => normalizeOutput(name, output));
  const providerVersions = extractProviderVersions(state as Record<string, unknown>);
  const normalizedProviders = uniqueByAddress(providers).map((provider) => ({
    ...provider,
    version: provider.version ?? providerVersions.get(provider.source ?? "") ?? providerVersions.get(provider.name)
  }));

  return {
    metadata: {
      version: 4,
      terraformVersion: state.terraform_version,
      serial: state.serial,
      lineage: state.lineage
    },
    providers: normalizedProviders,
    modules: uniqueByAddress(modules),
    resources,
    outputs,
    dependencies,
    warnings
  };
}

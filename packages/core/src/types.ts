export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ResourceMode = "managed" | "data";
export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface TerraformState {
  version: 4;
  terraform_version?: string;
  serial: number;
  lineage: string;
  outputs?: Record<string, unknown>;
  resources?: unknown[];
  [key: string]: unknown;
}

export interface ParsedStateMetadata {
  version: 4;
  terraformVersion?: string;
  serial: number;
  lineage: string;
}

export interface ParsedState {
  metadata: ParsedStateMetadata;
  providers: ParsedProvider[];
  modules: ParsedModule[];
  resources: ParsedResource[];
  outputs: ParsedOutput[];
  dependencies: ParsedDependency[];
  warnings: string[];
}

export interface ParsedProvider {
  address: string;
  source?: string;
  name: string;
  alias?: string;
  version?: string;
}

export interface ParsedModule {
  address: string;
  path: string[];
  parentAddress?: string;
}

export interface ParsedResource {
  mode: ResourceMode;
  type: string;
  name: string;
  address: string;
  moduleAddress?: string;
  providerAddress?: string;
  providerName?: string;
  instances: ParsedResourceInstance[];
}

export interface ParsedResourceInstance {
  address: string;
  resourceAddress: string;
  indexKey?: string | number;
  schemaVersion?: number;
  attributesJson: JsonValue;
  sensitivePaths: string[];
  attributes: ParsedAttribute[];
  dependencies: ParsedDependency[];
}

export interface ParsedAttribute {
  resourceAddress: string;
  instanceAddress: string;
  keyPath: string;
  value: JsonValue;
  valueType: string;
  displayValue: string;
  isSensitive: boolean;
  sensitiveReason?: string;
}

export interface ParsedOutput {
  name: string;
  value: JsonValue;
  type?: JsonValue;
  displayValue: string;
  isSensitive: boolean;
  sensitiveReason?: string;
}

export interface ParsedDependency {
  sourceAddress: string;
  targetAddress: string;
  dependencyType: "implicit" | "explicit" | "unknown";
}

export interface SnapshotResource {
  address: string;
  mode?: ResourceMode;
  type?: string;
  providerAddress?: string;
  moduleAddress?: string;
}

export interface SnapshotAttribute {
  resourceAddress: string;
  keyPath: string;
  value: JsonValue;
  displayValue: string;
  isSensitive: boolean;
  resourceType?: string;
}

export interface SnapshotOutput {
  name: string;
  value: JsonValue;
  displayValue: string;
  isSensitive: boolean;
}

export interface SnapshotProvider {
  address: string;
  name?: string;
  version?: string;
  source?: string;
}

export interface SnapshotModule {
  address: string;
  parentAddress?: string;
}

export interface StateSnapshot {
  resources: Map<string, SnapshotResource>;
  attributes: Map<string, SnapshotAttribute>;
  outputs: Map<string, SnapshotOutput>;
  providers: Map<string, SnapshotProvider>;
  modules: Map<string, SnapshotModule>;
}

export type ChangeEventType =
  | "resource_added"
  | "resource_removed"
  | "resource_changed"
  | "attribute_changed"
  | "output_added"
  | "output_removed"
  | "output_changed"
  | "provider_changed"
  | "module_changed";

export interface ChangeEventDraft {
  type: ChangeEventType;
  address?: string;
  keyPath?: string;
  oldValue?: JsonValue;
  newValue?: JsonValue;
  oldDisplayValue?: string;
  newDisplayValue?: string;
  severity: Severity;
  summary: string;
  metadata?: Record<string, JsonValue>;
}

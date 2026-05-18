import { parseTerraformState, type TerraformStateInput } from "@statebase/parser";
import type { ParsedState } from "@statebase/core/browser";

export interface LocalDataset {
  parsed: ParsedState;
  resources: Record<string, unknown>[];
  resource_instances: Record<string, unknown>[];
  resource_attributes: Record<string, unknown>[];
  outputs: Record<string, unknown>[];
  providers: Record<string, unknown>[];
  modules: Record<string, unknown>[];
  dependencies: Record<string, unknown>[];
  change_events: Record<string, unknown>[];
}

export function datasetFromParsed(parsed: ParsedState): LocalDataset {
  const resources: Record<string, unknown>[] = [];
  const resource_instances: Record<string, unknown>[] = [];
  const resource_attributes: Record<string, unknown>[] = [];
  const outputs = parsed.outputs.map((output) => ({ ...output, value_json: output.value, type_json: output.type }));
  const providers = parsed.providers.map((provider) => ({ ...provider }));
  const modules = parsed.modules.map((module) => ({ ...module }));
  const dependencies = parsed.dependencies.map((dep) => ({ ...dep, source_address: dep.sourceAddress, target_address: dep.targetAddress, dependency_type: dep.dependencyType }));

  for (const resource of parsed.resources) {
    resources.push({
      mode: resource.mode,
      type: resource.type,
      name: resource.name,
      address: resource.address,
      module_address: resource.moduleAddress ?? null,
      provider_address: resource.providerAddress ?? null,
      provider_name: resource.providerName ?? null,
      instances: resource.instances.length
    });
    for (const instance of resource.instances) {
      resource_instances.push({
        address: instance.address,
        resource_address: instance.resourceAddress,
        index_key: instance.indexKey ?? null,
        schema_version: instance.schemaVersion ?? null,
        attributes_json: instance.attributesJson,
        sensitive_paths_json: instance.sensitivePaths
      });
      for (const attr of instance.attributes) {
        resource_attributes.push({
          resource_address: instance.address,
          key_path: attr.keyPath,
          value_type: attr.valueType,
          value_json: attr.value,
          display_value: attr.displayValue,
          is_sensitive: attr.isSensitive,
          sensitive_reason: attr.sensitiveReason ?? null
        });
      }
    }
  }

  return { parsed, resources, resource_instances, resource_attributes, outputs, providers, modules, dependencies, change_events: [] };
}

export function datasetFromState(state: TerraformStateInput | unknown): LocalDataset {
  return datasetFromParsed(parseTerraformState(state));
}

import { stableStringify } from "./json.js";
import { classifyAttributeChange, severityForResourceLifecycle } from "./severity.js";
import type {
  ChangeEventDraft,
  ParsedState,
  SnapshotAttribute,
  SnapshotModule,
  SnapshotOutput,
  SnapshotProvider,
  SnapshotResource,
  StateSnapshot
} from "./types.js";

function attributeKey(resourceAddress: string, keyPath: string): string {
  return `${resourceAddress}::${keyPath}`;
}

export function snapshotFromParsedState(parsed: ParsedState): StateSnapshot {
  const resources = new Map<string, SnapshotResource>();
  const attributes = new Map<string, SnapshotAttribute>();
  const outputs = new Map<string, SnapshotOutput>();
  const providers = new Map<string, SnapshotProvider>();
  const modules = new Map<string, SnapshotModule>();

  for (const provider of parsed.providers) {
    providers.set(provider.address, provider);
  }

  for (const module of parsed.modules) {
    modules.set(module.address, module);
  }

  for (const resource of parsed.resources) {
    for (const instance of resource.instances.length > 0 ? resource.instances : []) {
      resources.set(instance.address, {
        address: instance.address,
        mode: resource.mode,
        type: resource.type,
        providerAddress: resource.providerAddress,
        moduleAddress: resource.moduleAddress
      });
      for (const attribute of instance.attributes) {
        attributes.set(attributeKey(instance.address, attribute.keyPath), {
          resourceAddress: instance.address,
          keyPath: attribute.keyPath,
          value: attribute.value,
          displayValue: attribute.displayValue,
          isSensitive: attribute.isSensitive,
          resourceType: resource.type
        });
      }
    }
  }

  for (const output of parsed.outputs) {
    outputs.set(output.name, output);
  }

  return { resources, attributes, outputs, providers, modules };
}

export function emptySnapshot(): StateSnapshot {
  return {
    resources: new Map(),
    attributes: new Map(),
    outputs: new Map(),
    providers: new Map(),
    modules: new Map()
  };
}

function changed(a: unknown, b: unknown): boolean {
  return stableStringify(a) !== stableStringify(b);
}

export function diffSnapshots(previous: StateSnapshot, current: StateSnapshot): ChangeEventDraft[] {
  const events: ChangeEventDraft[] = [];

  for (const [address, resource] of current.resources) {
    if (!previous.resources.has(address)) {
      const severity = severityForResourceLifecycle("added", resource.type);
      events.push({
        type: "resource_added",
        address,
        severity: severity.severity,
        summary: severity.summary,
        metadata: { resourceType: resource.type ?? null }
      });
    }
  }

  for (const [address, resource] of previous.resources) {
    if (!current.resources.has(address)) {
      const severity = severityForResourceLifecycle("removed", resource.type);
      events.push({
        type: "resource_removed",
        address,
        severity: severity.severity,
        summary: severity.summary,
        metadata: { resourceType: resource.type ?? null }
      });
    }
  }

  for (const [key, attr] of current.attributes) {
    const previousAttr = previous.attributes.get(key);
    if (!previousAttr) continue;
    if (!changed(previousAttr.value, attr.value)) continue;
    const severity = classifyAttributeChange({
      resourceAddress: attr.resourceAddress,
      resourceType: attr.resourceType,
      keyPath: attr.keyPath,
      oldValue: previousAttr.value,
      newValue: attr.value
    });
    events.push({
      type: "attribute_changed",
      address: attr.resourceAddress,
      keyPath: attr.keyPath,
      oldValue: previousAttr.value,
      newValue: attr.value,
      oldDisplayValue: previousAttr.displayValue,
      newDisplayValue: attr.displayValue,
      severity: severity.severity,
      summary: severity.summary,
      metadata: {
        sensitive: attr.isSensitive || previousAttr.isSensitive,
        resourceType: attr.resourceType ?? null
      }
    });
  }

  for (const [key, attr] of current.attributes) {
    if (!previous.attributes.has(key) && previous.resources.has(attr.resourceAddress)) {
      events.push({
        type: "attribute_changed",
        address: attr.resourceAddress,
        keyPath: attr.keyPath,
        oldValue: null,
        newValue: attr.value,
        oldDisplayValue: "",
        newDisplayValue: attr.displayValue,
        severity: attr.isSensitive ? "medium" : "low",
        summary: "Attribute added",
        metadata: { sensitive: attr.isSensitive }
      });
    }
  }

  for (const [key, attr] of previous.attributes) {
    if (!current.attributes.has(key) && current.resources.has(attr.resourceAddress)) {
      events.push({
        type: "attribute_changed",
        address: attr.resourceAddress,
        keyPath: attr.keyPath,
        oldValue: attr.value,
        newValue: null,
        oldDisplayValue: attr.displayValue,
        newDisplayValue: "",
        severity: attr.isSensitive ? "medium" : "low",
        summary: "Attribute removed",
        metadata: { sensitive: attr.isSensitive }
      });
    }
  }

  for (const [name, output] of current.outputs) {
    const before = previous.outputs.get(name);
    if (!before) {
      events.push({ type: "output_added", address: name, newValue: output.value, newDisplayValue: output.displayValue, severity: output.isSensitive ? "medium" : "info", summary: "Output added" });
    } else if (changed(before.value, output.value)) {
      events.push({
        type: "output_changed",
        address: name,
        oldValue: before.value,
        newValue: output.value,
        oldDisplayValue: before.displayValue,
        newDisplayValue: output.displayValue,
        severity: output.isSensitive || before.isSensitive ? "medium" : "low",
        summary: "Output changed"
      });
    }
  }

  for (const [name, output] of previous.outputs) {
    if (!current.outputs.has(name)) {
      events.push({ type: "output_removed", address: name, oldValue: output.value, oldDisplayValue: output.displayValue, severity: output.isSensitive ? "medium" : "info", summary: "Output removed" });
    }
  }

  for (const [address, provider] of current.providers) {
    const before = previous.providers.get(address);
    if (!before) {
      events.push({ type: "provider_changed", address, severity: "info", summary: "Provider added", metadata: { version: provider.version ?? null } });
    } else if (provider.version !== before.version || provider.source !== before.source) {
      events.push({ type: "provider_changed", address, severity: "low", summary: "Provider metadata changed", metadata: { oldVersion: before.version ?? null, newVersion: provider.version ?? null } });
    }
  }

  for (const [address] of previous.providers) {
    if (!current.providers.has(address)) {
      events.push({ type: "provider_changed", address, severity: "info", summary: "Provider removed" });
    }
  }

  for (const [address, module] of current.modules) {
    const before = previous.modules.get(address);
    if (!before) {
      events.push({ type: "module_changed", address, severity: "info", summary: "Module added", metadata: { parentAddress: module.parentAddress ?? null } });
    }
  }

  for (const [address] of previous.modules) {
    if (!current.modules.has(address)) {
      events.push({ type: "module_changed", address, severity: "info", summary: "Module removed" });
    }
  }

  return events;
}

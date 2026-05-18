import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TerraformStateParseError, parseTerraformState } from "../src/index.js";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
function fixture(name: string) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), "utf8"));
}

describe("parseTerraformState", () => {
  it("parses valid Terraform state v4 metadata", () => {
    const parsed = parseTerraformState(fixture("aws-basic.tfstate.json"));
    expect(parsed.metadata.version).toBe(4);
    expect(parsed.metadata.serial).toBe(12);
    expect(parsed.resources).toHaveLength(3);
    expect(parsed.outputs[0]?.name).toBe("bucket_name");
  });

  it("rejects invalid state", () => {
    expect(() => parseTerraformState({ version: 3, serial: 1 })).toThrow(TerraformStateParseError);
  });

  it("normalizes resources, outputs, providers and dependencies", () => {
    const parsed = parseTerraformState(fixture("aws-basic.tfstate.json"));
    expect(parsed.providers[0]?.name).toBe("aws");
    expect(parsed.dependencies[0]?.targetAddress).toBe("aws_security_group.web");
    expect(parsed.resources.find((r) => r.type === "aws_instance")?.instances[0]?.address).toBe("aws_instance.web");
  });

  it("handles modules and indexed instances", () => {
    const parsed = parseTerraformState(fixture("multi-module.tfstate.json"));
    expect(parsed.modules.map((m) => m.address)).toContain("module.app");
    const app = parsed.resources.find((r) => r.address === "module.app.aws_instance.app");
    expect(app?.instances.map((i) => i.address)).toEqual(["module.app.aws_instance.app[0]", "module.app.aws_instance.app[1]"]);
  });

  it("flattens nested attributes", () => {
    const parsed = parseTerraformState(fixture("aws-basic.tfstate.json"));
    const attrs = parsed.resources.find((r) => r.type === "aws_instance")?.instances[0]?.attributes ?? [];
    expect(attrs.find((a) => a.keyPath === "tags.Environment")?.displayValue).toBe("prod");
    expect(attrs.find((a) => a.keyPath === "instance_type")?.displayValue).toBe("t3.micro");
  });

  it("redacts sensitive fields and outputs", () => {
    const parsed = parseTerraformState(fixture("sensitive-values.tfstate.json"));
    const attrs = parsed.resources.flatMap((resource) => resource.instances).flatMap((instance) => instance.attributes);
    const password = attrs.find((a) => a.keyPath === "password");
    expect(password?.isSensitive).toBe(true);
    expect(password?.displayValue).toBe("[REDACTED]");
    expect(password?.value).toBe("__STATEBASE_REDACTED__");
    expect(parsed.outputs.find((o) => o.name === "db_password")?.displayValue).toBe("[REDACTED]");
  });
});

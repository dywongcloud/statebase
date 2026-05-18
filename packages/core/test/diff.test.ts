import { describe, expect, it } from "vitest";
import { diffSnapshots, emptySnapshot, type StateSnapshot } from "../src/index.js";

function snapshot(attrs: Array<{ address: string; type: string; key: string; value: any; display?: string }>): StateSnapshot {
  const snap = emptySnapshot();
  for (const attr of attrs) {
    snap.resources.set(attr.address, { address: attr.address, type: attr.type });
    snap.attributes.set(`${attr.address}::${attr.key}`, {
      resourceAddress: attr.address,
      resourceType: attr.type,
      keyPath: attr.key,
      value: attr.value,
      displayValue: attr.display ?? String(attr.value),
      isSensitive: false
    });
  }
  return snap;
}

describe("diff engine", () => {
  it("detects resource added and removed", () => {
    const before = snapshot([{ address: "aws_instance.old", type: "aws_instance", key: "id", value: "old" }]);
    const after = snapshot([{ address: "aws_instance.new", type: "aws_instance", key: "id", value: "new" }]);
    const events = diffSnapshots(before, after);
    expect(events.map((e) => e.type)).toContain("resource_added");
    expect(events.map((e) => e.type)).toContain("resource_removed");
  });

  it("detects attribute changed", () => {
    const before = snapshot([{ address: "aws_instance.web", type: "aws_instance", key: "instance_type", value: "t3.micro" }]);
    const after = snapshot([{ address: "aws_instance.web", type: "aws_instance", key: "instance_type", value: "t3.small" }]);
    const events = diffSnapshots(before, after);
    expect(events.find((e) => e.type === "attribute_changed")?.keyPath).toBe("instance_type");
  });

  it("marks public security group CIDR change high", () => {
    const before = snapshot([{ address: "aws_security_group.db", type: "aws_security_group", key: "ingress[0].cidr_blocks[0]", value: "10.0.0.0/8" }]);
    const after = snapshot([{ address: "aws_security_group.db", type: "aws_security_group", key: "ingress[0].cidr_blocks[0]", value: "0.0.0.0/0" }]);
    const event = diffSnapshots(before, after).find((e) => e.type === "attribute_changed");
    expect(event?.severity).toBe("high");
  });

  it("marks public database change high", () => {
    const before = snapshot([{ address: "aws_db_instance.primary", type: "aws_db_instance", key: "publicly_accessible", value: false }]);
    const after = snapshot([{ address: "aws_db_instance.primary", type: "aws_db_instance", key: "publicly_accessible", value: true }]);
    const event = diffSnapshots(before, after).find((e) => e.type === "attribute_changed");
    expect(event?.severity).toBe("high");
  });
});

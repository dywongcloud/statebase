import { describe, expect, it } from "vitest";
import { detectSensitive, displayValueForApi, sanitizeForStorage } from "../src/index.js";

describe("sensitive detection", () => {
  it("detects password key names", () => {
    expect(detectSensitive({ keyPath: "database.password", value: "fake" }).isSensitive).toBe(true);
  });

  it("detects token key names", () => {
    expect(detectSensitive({ keyPath: "github_token", value: "fake" }).isSensitive).toBe(true);
  });

  it("detects private key values", () => {
    expect(detectSensitive({ keyPath: "pem", value: "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----" }).isSensitive).toBe(true);
  });

  it("does not mark normal fields as sensitive", () => {
    expect(detectSensitive({ keyPath: "tags.Environment", value: "prod" }).isSensitive).toBe(false);
  });

  it("sanitizes sensitive values", () => {
    expect(sanitizeForStorage("secret", true)).toBe("__STATEBASE_REDACTED__");
    expect(displayValueForApi("secret", true)).toBe("[REDACTED]");
  });
});

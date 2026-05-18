import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "@statebase/core";

describe("api query guard", () => {
  it("allows select and blocks mutation", () => {
    expect(validateReadOnlySql("SELECT * FROM resources").ok).toBe(true);
    expect(validateReadOnlySql("DELETE FROM resources").ok).toBe(false);
  });
});

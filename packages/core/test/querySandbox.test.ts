import { describe, expect, it } from "vitest";
import { validateReadOnlySql } from "../src/index.js";

describe("query sandbox", () => {
  it("allows SELECT", () => {
    expect(validateReadOnlySql("SELECT type, COUNT(*) FROM resources GROUP BY type").ok).toBe(true);
  });

  it("blocks mutations", () => {
    for (const sql of ["INSERT INTO resources(id) VALUES ('x')", "UPDATE resources SET name='x'", "DELETE FROM resources", "DROP TABLE resources"]) {
      expect(validateReadOnlySql(sql).ok).toBe(false);
    }
  });

  it("blocks restricted identifiers", () => {
    expect(validateReadOnlySql("SELECT token_hash FROM api_tokens").ok).toBe(false);
    expect(validateReadOnlySql("SELECT * FROM public.resources").ok).toBe(false);
  });
});

import { describe, expect, it } from "vite-plus/test";
// @ts-expect-error The gate is deliberately plain ESM for direct Node execution.
import { checkTrace } from "../scripts/check-invariants.mjs";

describe("invariant trace gate", () => {
  it("accepts numbered test titles", () => {
    expect(checkTrace("INV-1 INV-2", 'it("INV-1 INV-2: contract", () => {})')).toBe(2);
  });
  it("rejects missing IDs, comments-only matches and empty documentation", () => {
    expect(() => checkTrace("INV-1", "// INV-1")).toThrow(/Missing/);
    expect(() => checkTrace("INV-1", 'it("INV-10: other", () => {})')).toThrow(/Missing/);
    expect(() => checkTrace("no IDs", "")).toThrow(/No invariants/);
  });
});

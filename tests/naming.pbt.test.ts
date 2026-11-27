import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";
import { resourcePrefix } from "../src/naming.js";

// Independent reference grammar: length, alphabet and first-character rules.
function validProject(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 20 &&
    value.split("").every((char) => "abcdefghijklmnopqrstuvwxyz0123456789-".includes(char)) &&
    "abcdefghijklmnopqrstuvwxyz".includes(value[0] ?? "\u0000")
  );
}

describe("resourcePrefix", () => {
  it("INV-4: accepts exactly the documented project grammar", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 50 }), (project) => {
        if (validProject(project)) expect(resourcePrefix(project, "dev")).toBe(`${project}-dev`);
        else expect(() => resourcePrefix(project, "dev")).toThrow(/project must/);
      }),
    );
  });
  it.each(["a", "a".repeat(20), "a-0", "z9-"])("accepts boundary %s", (project) => {
    expect(resourcePrefix(project, "prod")).toBe(`${project}-prod`);
  });
  it.each(["", "a".repeat(21), "-a", "0a", "A", "a_b", "a\n", "a/"])(
    "rejects boundary %j",
    (project) => {
      expect(() => resourcePrefix(project, "test")).toThrow();
    },
  );
});

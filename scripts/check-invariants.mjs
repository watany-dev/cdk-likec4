import { readFileSync, readdirSync } from "node:fs";

export function checkTrace(doc, tests) {
  const ids = [...new Set(doc.match(/INV-\d+/g) ?? [])];
  if (ids.length === 0) throw new Error("No invariants documented");
  const missing = ids.filter((id) => !new RegExp(`\\bit\\(\\s*["'][^"']*\\b${id}\\b`).test(tests));
  if (missing.length) throw new Error(`Missing PBT test titles: ${missing.join(", ")}`);
  return ids.length;
}

if (process.argv[1]?.endsWith("check-invariants.mjs")) {
  const doc = readFileSync("docs/invariants.md", "utf8");
  const tests = readdirSync("tests")
    .filter((file) => file.endsWith(".pbt.test.ts"))
    .map((file) => readFileSync(`tests/${file}`, "utf8"))
    .join("\n");
  console.log(`Invariant trace: ${checkTrace(doc, tests)} documented IDs have PBT test titles.`);
}

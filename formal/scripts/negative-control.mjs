import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

// A passing checker is meaningful only if removing the guard is rejected.
const dir = mkdtempSync(".negative-");
try {
  const original = readFileSync("src/deployment.ts", "utf8");
  const guard = "if (!bucketReady || catalogReady) return;";
  if (!original.includes(guard)) throw new Error("negative-control guard is missing");
  const file = join(dir, "broken.ts");
  writeFileSync(file, original.replace(guard, "if (catalogReady) return;"));
  const result = spawnSync(process.execPath, ["node_modules/tla-ts/dist/cli.js", file], {
    encoding: "utf8",
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status === 0 || !/Invariant ReferenceTargetExists is violated/.test(output)) {
    throw new Error(
      `Expected a reference-integrity counterexample, got status ${result.status}:\n${output}`,
    );
  }
  console.log("Negative control passed: missing create guard violates ReferenceTargetExists.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}

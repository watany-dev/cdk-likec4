import { defineConfig } from "vite-plus";

const generated = [
  "node_modules/**",
  "formal/node_modules/**",
  "cdk.out/**",
  "dist/**",
  "coverage/**",
  "reports/**",
  "diagrams/**",
  ".cache/**",
  ".stryker-tmp/**",
];

export default defineConfig({
  root: "web",
  build: { outDir: "../dist", emptyOutDir: true },
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    // Deep PBT runs synthesize once per case; scale their budget with FC_RUNS.
    testTimeout: 30000 * Math.max(1, Number(process.env.FC_RUNS ?? 100) / 100),
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 95 },
      reporter: ["text", "html", "json-summary"],
    },
  },
  lint: {
    ignorePatterns: generated,
    env: { node: true },
    options: { typeAware: true, typeCheck: true },
    rules: { "typescript/no-explicit-any": "error", "no-var": "error" },
  },
  fmt: {
    ignorePatterns: [...generated, "**/package-lock.json", "formal/src/*.tla", "formal/src/*.cfg"],
  },
});

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GraphvizWasmAdapter } from "likec4/layouts";

// LikeC4's own WASM renderer: no native dot, browser download or cloud service.
// This is a Graphviz rendering, not a screenshot of the interactive LikeC4 UI.
const graphviz = new GraphvizWasmAdapter();
try {
  const files = readdirSync("diagrams", { recursive: true }).filter((file) =>
    file.endsWith(".dot"),
  );
  if (files.length === 0) throw new Error("LikeC4 generated no DOT views");
  for (const file of files) {
    const path = join("diagrams", file);
    const svg = await graphviz.svg(readFileSync(path, "utf8"));
    if (!svg.includes("<svg")) throw new Error(`Invalid SVG: ${path}`);
    const output = path.replace(/\.dot$/, ".svg");
    writeFileSync(output, svg);
    console.log(`Exported ${output}`);
  }
} finally {
  graphviz.dispose();
}

import { defineConfig } from "tsup";

export default defineConfig({
  // Named entries keep dist/index.js where package.json "main" points, whatever the common root is.
  entry: { index: "src/index.ts", jev: "src/jev.ts", "cli/index": "cli/index.ts" },
  format: ["esm"],
  dts: { entry: { index: "src/index.ts", jev: "src/jev.ts" } },
  clean: true,
  sourcemap: true,
});

import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "cli/index.ts"],
  format: ["esm"],
  dts: { entry: ["src/index.ts"] },
  clean: true,
  sourcemap: true,
});

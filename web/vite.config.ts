import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "tariff-engine": resolve(__dirname, "../src/index.ts"),
      "node:fs": resolve(__dirname, "src/stubs/fs.ts"),
      "node:path": resolve(__dirname, "src/stubs/path.ts"),
    },
  },
  json: {
    stringify: true,
  },
});

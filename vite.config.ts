import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

import { resolveBasePath } from "./src/lib/base-path";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const basePath = process.env.VITE_BASE_PATH ?? fileEnv.VITE_BASE_PATH;

  return {
    base: resolveBasePath(basePath),
    plugins: [react(), tailwindcss()],
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});

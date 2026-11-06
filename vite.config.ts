import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

import { practiceTutorPlugin } from "./practiceTutorPlugin";
import { resolveBasePath } from "./src/lib/base-path";

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), "VITE_");
  const serverEnv = loadEnv(mode, process.cwd(), "OPENAI_");
  const apiKey = process.env.OPENAI_API_KEY ?? serverEnv.OPENAI_API_KEY;
  const basePath = process.env.VITE_BASE_PATH ?? fileEnv.VITE_BASE_PATH;

  return {
    base: resolveBasePath(basePath),
    plugins: [react(), tailwindcss(), ...(apiKey ? [practiceTutorPlugin(apiKey)] : [])],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/@supabase/")) return "supabase";
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
    },
  };
});

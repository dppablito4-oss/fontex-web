import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  testIgnore: process.env.FONTEX_CLASSROOM_E2E ? [] : ["**/classroom.spec.ts"],
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "desktop-light", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "light" } },
    { name: "mobile", use: { ...devices["Pixel 7"], colorScheme: "dark" } },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI && !process.env.FONTEX_CLASSROOM_E2E,
    env: { VITE_SUPABASE_URL: process.env.FONTEX_CLASSROOM_E2E ? "https://classroom-test.invalid" : "", VITE_SUPABASE_PUBLISHABLE_KEY: process.env.FONTEX_CLASSROOM_E2E ? "sb_publishable_classroom_test" : "", VITE_BASE_PATH: "/" },
  },
});

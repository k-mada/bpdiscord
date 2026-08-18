import { defineConfig, devices } from "@playwright/test";

// vite binds `localhost` only, which resolves to ::1 here — 127.0.0.1 refuses.
const ORIGIN = "http://localhost:5174";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? "line" : "list",
  use: {
    baseURL: ORIGIN,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // BROWSER=none stops vite's `open: true` launching a real window mid-run.
    command: "yarn vite --port 5174 --strictPort",
    url: `${ORIGIN}/e2e/harness/`,
    reuseExistingServer: !process.env["CI"],
    env: { BROWSER: "none" },
    timeout: 120_000,
  },
});

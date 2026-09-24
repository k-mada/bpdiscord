import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    extensions: [".ts", ".tsx", ".mjs", ".js", ".mts", ".jsx", ".json"],
  },
  build: {
    outDir: "build",
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // userEvent-heavy component tests (typing + repeated modal open/pick cycles)
    // run well under this locally but crowd the 5s default on slower CI runners.
    testTimeout: 15000,
    hookTimeout: 15000,
    // e2e/ is Playwright's; its .spec.ts files are not vitest suites
    exclude: [...configDefaults.exclude, "e2e/**"],
    setupFiles: ["./setupTests.ts"],
    coverage: {
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});

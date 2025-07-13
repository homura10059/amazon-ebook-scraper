import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 30000, // 30 seconds timeout
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/", "**/*.config.*", "**/*.d.ts"],
    },
  },
});

import { availableParallelism } from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Default config targets the local Docker rippled.

// Cap workers at 4 to limit load on the standalone node.
const MAX_WORKERS = Math.min(availableParallelism(), 4);
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    // No thresholds: line coverage of src is not a meaningful gate for integration suites
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,js}"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
    },
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@tests": path.resolve(import.meta.dirname, "./tests"),
    },
    testTimeout: 30000,
    // Files run in parallel with a separate funding account for each worker slot.
    fileParallelism: true,
    maxWorkers: MAX_WORKERS,
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/setup-local.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});

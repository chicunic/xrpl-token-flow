import path from "node:path";
import { defineConfig } from "vitest/config";

// Devnet config: runs tests against the public devnet (XRPL_NETWORK=devnet).
// Requires FUND_SECRET in .env — setup-devnet.ts fails fast if it is missing.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.{ts,js}"],
      exclude: ["src/**/*.d.ts", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
    testTimeout: 120000,
    // Low concurrency: devnet ledgers close every ~3-5s. Drop maxWorkers to 1 on tefPAST_SEQ/tecUNFUNDED.
    fileParallelism: true,
    maxWorkers: 2,
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/setup-devnet.ts"],
    clearMocks: true,
    restoreMocks: true,
    env: {
      XRPL_NETWORK: "devnet",
    },
  },
});

import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,js}'],
      exclude: ['src/**/*.d.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
    },
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/setup-local.ts'],
    clearMocks: true,
    restoreMocks: true,
    env: {
      XRPL_NETWORK: 'local',
    },
  },
});

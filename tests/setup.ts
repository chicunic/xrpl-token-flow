import path from 'node:path';
import { afterAll, beforeAll, expect, vi } from 'vitest';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;

const EXPECTED_ERROR_PREFIXES = ['Error expected in test:'];

beforeAll(() => {
  const testPath = expect.getState().testPath;
  const fileName = testPath ? path.relative(process.cwd(), testPath) : 'Unknown Test';
  process.stderr.write(`\n\x1b[1;33m▶▶▶ RUNNING TEST SUITE: ${fileName}\x1b[0m\n`);

  console.log = (...args: any[]) => {
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg))).join(' ');
    process.stderr.write(`\x1b[36m${message}\x1b[0m\n`);
  };

  console.error = vi.fn((...args: any[]) => {
    const fullMessage = args.map(arg => String(arg)).join(' ');
    const isExpected = EXPECTED_ERROR_PREFIXES.some(prefix => fullMessage.includes(prefix));
    if (!isExpected) {
      originalConsoleError(...args);
    }
  });
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

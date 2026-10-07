import path from "node:path";
import { afterAll, beforeAll, expect } from "vitest";
import { installTxObserver } from "./utils/kb-runtime.js";

const originalConsoleLog = console.log;

// No-op unless KB_CAPTURE=1; lets the knowledge base anchor facts to real transaction hashes.
installTxObserver();

beforeAll(() => {
  const testPath = expect.getState().testPath;
  const fileName = testPath ? path.relative(process.cwd(), testPath) : "Unknown Test";
  process.stderr.write(`\n\x1b[1;33m▶▶▶ RUNNING TEST SUITE: ${fileName}\x1b[0m\n`);

  console.log = (...args: unknown[]) => {
    const message = args
      .map((arg) =>
        typeof arg === "string" || typeof arg === "number" || typeof arg === "boolean"
          ? String(arg)
          : JSON.stringify(arg),
      )
      .join(" ");
    process.stderr.write(`\x1b[36m${message}\x1b[0m\n`);
  };
});

afterAll(() => {
  console.log = originalConsoleLog;
});

/**
 * Vitest globalSetup for the public devnet.
 *
 * Fails fast before any test runs if FUND_SECRET is missing — devnet has no genesis account, so wallet funding
 * needs a pre-funded account seed. Without it every test would otherwise throw the same error individually.
 */
import "dotenv/config";

export function setup(): void {
  if (!process.env.FUND_SECRET) {
    throw new Error(
      "FUND_SECRET is not set. Devnet tests need a pre-funded account seed.\n" +
        "Copy .env.example to .env and set FUND_SECRET, or run `pnpm test` for local Docker instead.",
    );
  }
}

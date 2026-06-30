import "dotenv/config";
import { Client } from "xrpl";

let client: Client | undefined;

const DEFAULT_ENDPOINT = "ws://127.0.0.1:6006";

export async function initializeXRPLClient(): Promise<void> {
  const xrplEndpoint = process.env.XRPL_ENDPOINT ?? DEFAULT_ENDPOINT;

  client = new Client(xrplEndpoint);
  await client.connect();

  console.log(`✅ Connected to XRPL: ${xrplEndpoint}`);
}

export function getXRPLClient(): Client {
  if (!client?.isConnected()) {
    throw new Error("XRPL client not initialized or connected");
  }
  return client;
}

export async function disconnectXRPLClient(): Promise<void> {
  if (client?.isConnected()) {
    await client.disconnect();
    console.log("✅ Disconnected from XRPL");
  }
}

import 'dotenv/config';
import { Client } from 'xrpl';

let client: Client;

const DEFAULT_DEVNET_ENDPOINT = 'wss://s.devnet.rippletest.net:51233';

const defaultEndpoints: Record<string, string> = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: DEFAULT_DEVNET_ENDPOINT,
};

export async function initializeXRPLClient(): Promise<void> {
  const network = process.env.XRPL_NETWORK ?? 'devnet';
  const xrplEndpoint = process.env.XRPL_ENDPOINT ?? defaultEndpoints[network] ?? DEFAULT_DEVNET_ENDPOINT;

  client = new Client(xrplEndpoint);
  await client.connect();

  console.log(`✅ Connected to XRPL ${network}: ${xrplEndpoint}`);
}

export function getXRPLClient(): Client {
  if (!client?.isConnected()) {
    throw new Error('XRPL client not initialized or connected');
  }
  return client;
}

export async function disconnectXRPLClient(): Promise<void> {
  if (client?.isConnected()) {
    await client.disconnect();
    console.log('✅ Disconnected from XRPL');
  }
}

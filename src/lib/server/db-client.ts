import { createClient, type Client } from '@libsql/client';
import { config } from '$lib/config';

let dbClient: Client | null = null;

function requiredValue(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`[db] Missing configuration value: ${name}`);
  }
  return normalized;
}

export function getClient(): Client {
  if (!dbClient) {
    dbClient = createClient({
      url: requiredValue('config.turso.databaseUrl', config.turso.databaseUrl),
      authToken: requiredValue('config.turso.authToken', config.turso.authToken),
    });
  }
  return dbClient;
}

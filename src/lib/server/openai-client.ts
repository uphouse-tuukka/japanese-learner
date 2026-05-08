import OpenAI from 'openai';

export type OpenAiClientOptions = {
  scope: string;
  apiKey: string;
  missingApiKeyMessage: string;
};

const openAiClients = new Map<string, OpenAI>();

export function getOpenAiClient(options: OpenAiClientOptions): OpenAI {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error(options.missingApiKeyMessage);
  }

  const cachedClient = openAiClients.get(options.scope);
  if (cachedClient) {
    return cachedClient;
  }

  const client = new OpenAI({ apiKey });
  openAiClients.set(options.scope, client);
  return client;
}

export function resetOpenAiClientsForTesting(): void {
  openAiClients.clear();
}

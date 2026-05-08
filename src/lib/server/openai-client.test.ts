import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockOpenAiConstructor } = vi.hoisted(() => ({
  mockOpenAiConstructor: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor(options: { apiKey: string }) {
      mockOpenAiConstructor(options);
    }
  },
}));

import { getOpenAiClient, resetOpenAiClientsForTesting } from '$lib/server/openai-client';

describe('getOpenAiClient', () => {
  beforeEach(() => {
    resetOpenAiClientsForTesting();
    mockOpenAiConstructor.mockClear();
  });

  it('throws the caller-provided missing API key message for blank keys', () => {
    expect(() =>
      getOpenAiClient({
        scope: 'ai',
        apiKey: '   ',
        missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
      }),
    ).toThrow('[ai] Missing OpenAI API key in config.openai.apiKey');
    expect(mockOpenAiConstructor).not.toHaveBeenCalled();
  });

  it('reuses a client for the same scope', () => {
    const first = getOpenAiClient({
      scope: 'ai',
      apiKey: 'test-api-key',
      missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
    });
    const second = getOpenAiClient({
      scope: 'ai',
      apiKey: 'test-api-key',
      missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
    });

    expect(second).toBe(first);
    expect(mockOpenAiConstructor).toHaveBeenCalledTimes(1);
  });

  it('creates separate clients for different scopes', () => {
    const sessionClient = getOpenAiClient({
      scope: 'ai',
      apiKey: 'test-api-key',
      missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
    });
    const portfolioClient = getOpenAiClient({
      scope: 'portfolio',
      apiKey: 'test-api-key',
      missingApiKeyMessage: '[portfolio] Missing OpenAI API key',
    });

    expect(portfolioClient).not.toBe(sessionClient);
    expect(mockOpenAiConstructor).toHaveBeenCalledTimes(2);
  });

  it('trims the API key before constructing OpenAI', () => {
    getOpenAiClient({
      scope: 'ai',
      apiKey: '  test-api-key  ',
      missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
    });

    expect(mockOpenAiConstructor).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
  });

  it('validates the caller API key before returning a cached client', () => {
    getOpenAiClient({
      scope: 'ai',
      apiKey: 'test-api-key',
      missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
    });

    expect(() =>
      getOpenAiClient({
        scope: 'ai',
        apiKey: '',
        missingApiKeyMessage: '[ai] Missing OpenAI API key in config.openai.apiKey',
      }),
    ).toThrow('[ai] Missing OpenAI API key in config.openai.apiKey');
    expect(mockOpenAiConstructor).toHaveBeenCalledTimes(1);
  });
});

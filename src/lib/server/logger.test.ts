import { afterEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo, logWarn, sanitizeMeta } from './logger';

describe('server logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts sensitive metadata keys recursively while preserving safe values', () => {
    const fakeApiKey = 'fake API key value';
    const fakePassword = 'fake password value';
    const sanitized = sanitizeMeta({
      sessionId: 'session-1',
      output_text: 'raw model output should not be logged',
      outputTextPreview: 'raw preview should not be logged',
      outputTextLength: 555,
      nested: {
        apiKey: fakeApiKey,
        count: 2,
        error: new Error('normalization failed'),
      },
      attempts: [
        {
          userResponse: 'learner answer should not be logged',
          ok: true,
        },
      ],
      resolvedCookieId: 'visitor-cookie-id',
      recentCookieStarts: 2,
      tokensInput: 42,
      ipAddress: '203.0.113.7',
      credentials: {
        username: 'learner',
        password: fakePassword,
      },
    });

    expect(sanitized).toEqual({
      sessionId: 'session-1',
      output_text: '[redacted]',
      outputTextPreview: '[redacted]',
      outputTextLength: 555,
      nested: {
        apiKey: '[redacted]',
        count: 2,
        error: 'normalization failed',
      },
      attempts: [
        {
          userResponse: '[redacted]',
          ok: true,
        },
      ],
      resolvedCookieId: '[redacted]',
      recentCookieStarts: 2,
      tokensInput: 42,
      ipAddress: '[redacted]',
      credentials: '[redacted]',
    });
  });

  it('truncates long string metadata values', () => {
    const longValue = 'x'.repeat(121);

    expect(sanitizeMeta({ longValue })).toEqual({
      longValue: `${'x'.repeat(120)}[truncated]`,
    });
  });

  it('redacts raw JSON parse snippets from error metadata and never throws on invalid dates', () => {
    const invalidDate = new Date(Number.NaN);

    expect(
      sanitizeMeta({
        error: 'Unexpected token \'s\', "sensitive model output" is not valid JSON',
        happenedAt: invalidDate,
      }),
    ).toEqual({
      error: '[redacted parse error]',
      happenedAt: '[invalid date]',
    });
  });

  it('logs info and warnings through console.warn with sanitized metadata', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    logInfo('ai', 'generated plan', { prompt: 'do not log me', exerciseCount: 4 });
    logWarn('missions-ai', 'fallback used', { content: 'raw output', turnNumber: 2 });

    expect(warnSpy).toHaveBeenNthCalledWith(1, '[ai] generated plan', {
      prompt: '[redacted]',
      exerciseCount: 4,
    });
    expect(warnSpy).toHaveBeenNthCalledWith(2, '[missions-ai] fallback used', {
      content: '[redacted]',
      turnNumber: 2,
    });
  });

  it('logs errors through console.error with sanitized metadata', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logError('portfolio', 'cleanup failed', {
      error: new Error('db unavailable'),
      cookie: 'session-cookie',
    });

    expect(errorSpy).toHaveBeenCalledWith('[portfolio] cleanup failed', {
      error: 'db unavailable',
      cookie: '[redacted]',
    });
  });
});

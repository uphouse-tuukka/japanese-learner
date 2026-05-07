import { describe, expect, it } from 'vitest';
import { jsonError, readJsonBody, requireStringField } from './api';

describe('readJsonBody', () => {
  it('returns parsed JSON for a valid request body', async () => {
    const request = new Request('https://example.test/api', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-123' }),
      headers: { 'content-type': 'application/json' },
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      ok: true,
      value: { userId: 'user-123' },
    });
  });

  it('returns an invalid-body result when request JSON parsing fails', async () => {
    const request = new Request('https://example.test/api', {
      method: 'POST',
      body: '{bad json',
      headers: { 'content-type': 'application/json' },
    });

    await expect(readJsonBody(request)).resolves.toEqual({
      ok: false,
      error: 'Invalid JSON body.',
    });
  });
});

describe('jsonError', () => {
  it('returns a JSON response with a default 400 status', async () => {
    const response = jsonError('Missing userId.');

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing userId.',
    });
  });

  it('includes a custom status and extra response fields', async () => {
    const response = jsonError('Not found.', 404, { code: 'not_found' });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Not found.',
      code: 'not_found',
    });
  });

  it('does not allow extra fields to override ok or error', async () => {
    const response = jsonError('Actual message.', 422, {
      ok: true,
      error: 'Override attempt.',
      details: { field: 'userId' },
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Actual message.',
      details: { field: 'userId' },
    });
  });
});

describe('requireStringField', () => {
  it('returns a trimmed string from a plain object', () => {
    expect(requireStringField({ userId: '  user-123  ' }, 'userId')).toEqual({
      ok: true,
      value: 'user-123',
    });
  });

  it('rejects a missing field', () => {
    expect(requireStringField({}, 'userId')).toEqual({
      ok: false,
      error: 'Missing userId.',
    });
  });

  it('rejects a blank string field', () => {
    expect(requireStringField({ userId: '   ' }, 'userId')).toEqual({
      ok: false,
      error: 'Missing userId.',
    });
  });

  it('rejects a non-string field', () => {
    expect(requireStringField({ userId: 123 }, 'userId')).toEqual({
      ok: false,
      error: 'Invalid userId.',
    });
  });

  it('rejects non-object bodies', () => {
    expect(requireStringField(null, 'userId')).toEqual({
      ok: false,
      error: 'Expected JSON object.',
    });
    expect(requireStringField(['user-123'], 'userId')).toEqual({
      ok: false,
      error: 'Expected JSON object.',
    });
  });
});

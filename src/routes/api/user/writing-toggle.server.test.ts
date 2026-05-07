import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetUserById, mockUpdateJapaneseWritingSetting } = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
  mockUpdateJapaneseWritingSetting: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getUserById: mockGetUserById,
  updateJapaneseWritingSetting: mockUpdateJapaneseWritingSetting,
}));

import { POST } from './writing-toggle/+server';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/user/writing-toggle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/user/writing-toggle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function buildCookies(selectedUserId: string | null = 'user-1') {
  const cookieValue = selectedUserId ?? undefined;

  return {
    get(name: string) {
      return name === 'selected_user' ? cookieValue : undefined;
    },
  };
}

async function toggleWriting(body: unknown, selectedUserId: string | null = 'user-1') {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoWrites() {
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockUpdateJapaneseWritingSetting).not.toHaveBeenCalled();
}

describe('POST /api/user/writing-toggle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockGetUserById.mockReset();
    mockUpdateJapaneseWritingSetting.mockReset();

    mockGetUserById.mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      level: 'beginner',
      japaneseWritingEnabled: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: null,
      progressJournal: null,
    });
    mockUpdateJapaneseWritingSetting.mockResolvedValue(undefined);
  });

  it('updates the writing setting for a matching selected_user cookie', async () => {
    const response = await toggleWriting({ userId: ' user-1 ', enabled: true }, ' user-1 ');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, enabled: true });
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockUpdateJapaneseWritingSetting).toHaveBeenCalledWith('user-1', true);
  });

  it('allows the writing setting update when no selected_user cookie is present', async () => {
    const response = await toggleWriting({ userId: 'user-1', enabled: false }, null);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, enabled: false });
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockUpdateJapaneseWritingSetting).toHaveBeenCalledWith('user-1', false);
  });

  it('returns 403 without DB writes when selected_user does not match body userId', async () => {
    const response = await toggleWriting({ userId: 'user-2', enabled: true }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoWrites();
  });

  it('returns 400 for invalid JSON without DB writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoWrites();
  });

  it('returns 400 for missing userId or enabled without DB writes', async () => {
    const response = await toggleWriting({ userId: 'user-1' }, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing userId or enabled.',
    });
    expectNoWrites();
  });

  it('returns 404 when the user does not exist', async () => {
    mockGetUserById.mockResolvedValueOnce(null);

    const response = await toggleWriting({ userId: 'user-missing', enabled: true }, null);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'User not found.' });
    expect(mockGetUserById).toHaveBeenCalledWith('user-missing');
    expect(mockUpdateJapaneseWritingSetting).not.toHaveBeenCalled();
  });

  it('returns 500 when updating the setting fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUpdateJapaneseWritingSetting.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await toggleWriting({ userId: 'user-1', enabled: true }, 'user-1');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to update writing setting.',
    });
  });
});

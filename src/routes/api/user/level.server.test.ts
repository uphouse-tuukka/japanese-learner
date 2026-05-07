import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetUserById, mockUpdateUserLevel } = vi.hoisted(() => ({
  mockGetUserById: vi.fn(),
  mockUpdateUserLevel: vi.fn(),
}));

vi.mock('$lib/server/db', () => ({
  getUserById: mockGetUserById,
  updateUserLevel: mockUpdateUserLevel,
}));

import { POST } from './level/+server';

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/user/level', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/user/level', {
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

async function updateLevel(body: unknown, selectedUserId: string | null = 'user-1') {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoWrites() {
  expect(mockGetUserById).not.toHaveBeenCalled();
  expect(mockUpdateUserLevel).not.toHaveBeenCalled();
}

describe('POST /api/user/level', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mockGetUserById.mockReset();
    mockUpdateUserLevel.mockReset();

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
    mockUpdateUserLevel.mockResolvedValue(undefined);
  });

  it('updates the level for a matching selected_user cookie', async () => {
    const response = await updateLevel({ userId: ' user-1 ', level: ' intermediate ' }, ' user-1 ');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, level: 'intermediate' });
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockUpdateUserLevel).toHaveBeenCalledWith('user-1', 'intermediate');
  });

  it('allows the level update when no selected_user cookie is present', async () => {
    const response = await updateLevel({ userId: 'user-1', level: 'elementary' }, null);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, level: 'elementary' });
    expect(mockGetUserById).toHaveBeenCalledWith('user-1');
    expect(mockUpdateUserLevel).toHaveBeenCalledWith('user-1', 'elementary');
  });

  it('returns 403 without DB writes when selected_user does not match body userId', async () => {
    const response = await updateLevel({ userId: 'user-2', level: 'beginner' }, 'user-1');

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

  it.each([
    ['missing userId', { level: 'beginner' }],
    ['missing level', { userId: 'user-1' }],
  ])('returns 400 for %s without DB writes', async (_caseName, body) => {
    const response = await updateLevel(body, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing userId or level.',
    });
    expectNoWrites();
  });

  it('returns 400 for invalid level without DB writes', async () => {
    const response = await updateLevel({ userId: 'user-1', level: 'expert' }, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid level.' });
    expectNoWrites();
  });

  it('returns 404 when the user does not exist', async () => {
    mockGetUserById.mockResolvedValueOnce(null);

    const response = await updateLevel({ userId: 'user-missing', level: 'beginner' }, null);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'User not found.' });
    expect(mockGetUserById).toHaveBeenCalledWith('user-missing');
    expect(mockUpdateUserLevel).not.toHaveBeenCalled();
  });

  it('returns 500 when updating the level fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUpdateUserLevel.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await updateLevel({ userId: 'user-1', level: 'elementary' }, 'user-1');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to update user level.',
    });
  });
});

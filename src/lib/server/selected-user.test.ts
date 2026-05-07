import { describe, expect, it } from 'vitest';
import {
  SELECTED_USER_COOKIE,
  matchSelectedUser,
  normalizeUserId,
  readSelectedUserId,
} from './selected-user';

function cookieReader(value: string | undefined) {
  return {
    get(name: string) {
      return name === SELECTED_USER_COOKIE ? value : undefined;
    },
  };
}

describe('normalizeUserId', () => {
  it('trims string user IDs', () => {
    expect(normalizeUserId('  user-123  ')).toBe('user-123');
  });

  it('returns null for missing, blank, or non-string values', () => {
    expect(normalizeUserId(undefined)).toBeNull();
    expect(normalizeUserId(null)).toBeNull();
    expect(normalizeUserId('   ')).toBeNull();
    expect(normalizeUserId(123)).toBeNull();
  });
});

describe('readSelectedUserId', () => {
  it('reads and normalizes the selected_user cookie', () => {
    expect(readSelectedUserId(cookieReader('  user-123  '))).toEqual({
      ok: true,
      userId: 'user-123',
    });
  });

  it('allows an absent selected_user cookie as no selected profile', () => {
    expect(readSelectedUserId(cookieReader(undefined))).toEqual({
      ok: true,
      userId: null,
    });
  });

  it('returns a structured failure for a blank selected_user cookie', () => {
    expect(readSelectedUserId(cookieReader('   '))).toEqual({
      ok: false,
      error: 'Invalid selected user.',
      status: 400,
    });
  });
});

describe('matchSelectedUser', () => {
  it('allows a body userId matching the selected_user cookie after normalization', () => {
    expect(matchSelectedUser(cookieReader('  user-123  '), ' user-123 ')).toEqual({
      ok: true,
      userId: 'user-123',
      selectedUserId: 'user-123',
    });
  });

  it('allows a valid body userId when there is no selected_user cookie', () => {
    expect(matchSelectedUser(cookieReader(undefined), ' user-123 ')).toEqual({
      ok: true,
      userId: 'user-123',
      selectedUserId: null,
    });
  });

  it('rejects a missing body userId with a structured failure', () => {
    expect(matchSelectedUser(cookieReader('user-123'), '   ')).toEqual({
      ok: false,
      error: 'Missing userId.',
      status: 400,
    });
  });

  it('rejects a selected_user cookie that does not match the body userId', () => {
    expect(matchSelectedUser(cookieReader('user-123'), 'user-456')).toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
      status: 403,
    });
  });
});

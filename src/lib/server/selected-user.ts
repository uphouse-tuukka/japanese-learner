export const SELECTED_USER_COOKIE = 'selected_user';

export type CookieReader = {
  get(name: string): string | undefined;
};

export type SelectedUserFailure = {
  ok: false;
  error: string;
  status: number;
};

export type SelectedUserResult =
  | {
      ok: true;
      userId: string | null;
    }
  | SelectedUserFailure;

export type SelectedUserMatchResult =
  | {
      ok: true;
      userId: string;
      selectedUserId: string | null;
    }
  | SelectedUserFailure;

export function normalizeUserId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readSelectedUserId(cookies: CookieReader): SelectedUserResult {
  const rawSelectedUserId = cookies.get(SELECTED_USER_COOKIE);
  if (rawSelectedUserId === undefined) {
    return { ok: true, userId: null };
  }

  const userId = normalizeUserId(rawSelectedUserId);
  if (!userId) {
    return {
      ok: false,
      error: 'Invalid selected user.',
      status: 400,
    };
  }

  return { ok: true, userId };
}

export function matchSelectedUser(
  cookies: CookieReader,
  bodyUserId: unknown,
): SelectedUserMatchResult {
  const userId = normalizeUserId(bodyUserId);
  if (!userId) {
    return {
      ok: false,
      error: 'Missing userId.',
      status: 400,
    };
  }

  const selectedUser = readSelectedUserId(cookies);
  if (selectedUser.ok === false) {
    return {
      ok: false,
      error: selectedUser.error,
      status: selectedUser.status,
    };
  }

  if (selectedUser.userId !== null && selectedUser.userId !== userId) {
    return {
      ok: false,
      error: 'Selected user does not match request user.',
      status: 403,
    };
  }

  return {
    ok: true,
    userId,
    selectedUserId: selectedUser.userId,
  };
}

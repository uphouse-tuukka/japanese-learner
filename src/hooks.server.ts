import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { config } from '$lib/config';
import { sessionConfig, validateSessionToken } from '$lib/server/auth';

function isStaticAsset(pathname: string): boolean {
  if (pathname.startsWith('/api/')) {
    return false;
  }

  return pathname.startsWith('/_app/') || /\.[a-zA-Z0-9]+$/.test(pathname);
}

function isLoginRequest(pathname: string, method: string): boolean {
  return pathname === '/api/auth/login' && method === 'POST';
}

export const handle: Handle = async ({ event, resolve }) => {
  const expectedUser = config.siteAccess.basicAuthUser?.trim() ?? '';

  if (!expectedUser) {
    event.locals.authenticated = true;
    return resolve(event);
  }

  const pathname = event.url.pathname;
  const method = event.request.method;
  const token = event.cookies.get(sessionConfig.cookieName);

  if (token) {
    const validation = validateSessionToken(token);
    if (validation.valid) {
      event.locals.authenticated = true;
      return resolve(event);
    }
  }

  event.locals.authenticated = false;

  if (isLoginRequest(pathname, method) || isStaticAsset(pathname)) {
    return resolve(event);
  }

  if (pathname.startsWith('/api/')) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return resolve(event);
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sessionConfig } from '$lib/server/auth';

export const POST: RequestHandler = async ({ cookies }) => {
  cookies.delete(sessionConfig.cookieName, { path: '/' });
  return json({ ok: true });
};

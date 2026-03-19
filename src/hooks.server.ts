import type { Handle } from '@sveltejs/kit';
import { config } from '$lib/config';

function unauthorized(): Response {
return new Response('Authentication required', {
status: 401,
headers: {
'WWW-Authenticate': 'Basic realm="Japanese Learner", charset="UTF-8"'
}
});
}

function parseAuthorization(header: string): { username: string; password: string } | null {
if (!header.startsWith('Basic ')) return null;

const encoded = header.slice(6).trim();
if (!encoded) return null;

try {
const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
const splitIndex = decoded.indexOf(':');
if (splitIndex < 0) return null;

return {
username: decoded.slice(0, splitIndex),
password: decoded.slice(splitIndex + 1)
};
} catch {
return null;
}
}

export const handle: Handle = async ({ event, resolve }) => {
const expectedUser = config.siteAccess.basicAuthUser?.trim() ?? '';
const expectedPassword = config.siteAccess.basicAuthPassword?.trim() ?? '';

if (!expectedUser || !expectedPassword) {
return resolve(event);
}

const credentials = parseAuthorization(event.request.headers.get('authorization') ?? '');
if (!credentials) {
return unauthorized();
}

if (credentials.username !== expectedUser || credentials.password !== expectedPassword) {
return unauthorized();
}

return resolve(event);
};

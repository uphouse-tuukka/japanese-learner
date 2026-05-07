import { json } from '@sveltejs/kit';

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: string };

export async function readJsonBody(request: Request): Promise<ApiResult<unknown>> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return { ok: false, error: 'Invalid JSON body.' };
  }
}

export function jsonError(
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return json({ ...(extra ?? {}), ok: false, error: message }, { status });
}

export function requireStringField(body: unknown, fieldName: string): ApiResult<string> {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Expected JSON object.' };
  }

  if (!Object.prototype.hasOwnProperty.call(body, fieldName)) {
    return { ok: false, error: `Missing ${fieldName}.` };
  }

  const value = body[fieldName];
  if (typeof value !== 'string') {
    return { ok: false, error: `Invalid ${fieldName}.` };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, error: `Missing ${fieldName}.` };
  }

  return { ok: true, value: trimmed };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

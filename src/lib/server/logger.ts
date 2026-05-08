const REDACTED = '[redacted]';
const REDACTED_PARSE_ERROR = '[redacted parse error]';
const MAX_STRING_LENGTH = 120;
const MAX_SANITIZE_DEPTH = 5;

type SanitizedMetaValue =
  | string
  | number
  | boolean
  | null
  | SanitizedMetaValue[]
  | { [key: string]: SanitizedMetaValue };

type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE_KEY_EXACT_MATCHES = new Set([
  'token',
  'secret',
  'password',
  'apikey',
  'authorization',
  'cookie',
  'prompt',
  'outputtext',
  'responsetext',
  'rawresponse',
  'rawoutput',
  'content',
  'answer',
  'answertext',
  'correctanswer',
  'providedcorrectanswer',
  'expectedanswer',
  'userresponse',
  'conversationhistory',
  'credential',
  'credentials',
  'ip',
  'ipaddress',
  'clientip',
  'remoteip',
  'rawip',
  'forwardedfor',
  'xforwardedfor',
]);

function normalizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  const isAggregateValueKey =
    normalized.endsWith('count') ||
    normalized.endsWith('counts') ||
    normalized.endsWith('length') ||
    normalized.endsWith('starts') ||
    normalized.endsWith('total');
  return (
    SENSITIVE_KEY_EXACT_MATCHES.has(normalized) ||
    (normalized.includes('secret') && !isAggregateValueKey) ||
    (normalized.includes('password') && !isAggregateValueKey) ||
    (normalized.includes('apikey') && !isAggregateValueKey) ||
    (normalized.includes('authorization') && !isAggregateValueKey) ||
    (normalized.includes('cookie') && !isAggregateValueKey) ||
    (normalized.includes('prompt') && !isAggregateValueKey) ||
    (normalized.includes('outputtext') && !isAggregateValueKey) ||
    (normalized.includes('responsetext') && !isAggregateValueKey) ||
    (normalized.includes('rawresponse') && !isAggregateValueKey) ||
    (normalized.includes('rawoutput') && !isAggregateValueKey) ||
    (normalized.includes('content') && !isAggregateValueKey) ||
    (normalized.includes('answer') && !isAggregateValueKey) ||
    (normalized.includes('userresponse') && !isAggregateValueKey) ||
    (normalized.includes('conversationhistory') && !isAggregateValueKey) ||
    (normalized.includes('credential') && !isAggregateValueKey) ||
    normalized.endsWith('token') ||
    normalized.endsWith('secret') ||
    normalized.endsWith('password') ||
    normalized.endsWith('apikey') ||
    normalized.endsWith('authorization') ||
    normalized.endsWith('cookie') ||
    normalized.endsWith('prompt') ||
    normalized.endsWith('answer') ||
    normalized.endsWith('answertext') ||
    normalized.endsWith('userresponse') ||
    normalized.endsWith('conversationhistory') ||
    normalized.endsWith('rawresponse') ||
    normalized.endsWith('rawoutput') ||
    normalized.endsWith('outputtext') ||
    normalized.endsWith('responsetext')
  );
}

function sanitizeString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}[truncated]`;
}

function isErrorKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    normalized === 'error' || normalized.endsWith('error') || normalized.endsWith('errormessage')
  );
}

function sanitizeErrorString(value: string): string {
  if (/not valid json|unexpected end of json input|unexpected token|json\.parse/i.test(value)) {
    return REDACTED_PARSE_ERROR;
  }

  return sanitizeString(value);
}

function sanitizeValue(
  value: unknown,
  key: string | null,
  seen: WeakSet<object>,
  depth: number,
): SanitizedMetaValue | undefined {
  if (key && isSensitiveKey(key)) {
    return REDACTED;
  }

  if (key && isErrorKey(key)) {
    if (value instanceof Error) {
      return sanitizeErrorString(value.message);
    }
    if (typeof value === 'string') {
      return sanitizeErrorString(value);
    }
  }

  if (value == null) {
    return null;
  }

  if (value instanceof Error) {
    return sanitizeErrorString(value.message);
  }

  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return sanitizeString(value.toString());
  }

  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return '[unserializable]';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '[invalid date]';
    }
    return value.toISOString();
  }

  if (depth <= 0) {
    return '[truncated object]';
  }

  if (typeof value !== 'object') {
    return sanitizeString(String(value));
  }

  if (seen.has(value)) {
    return '[circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, null, seen, depth - 1) ?? null);
  }

  const sanitized: Record<string, SanitizedMetaValue> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const sanitizedValue = sanitizeValue(entryValue, entryKey, seen, depth - 1);
    if (sanitizedValue !== undefined) {
      sanitized[entryKey] = sanitizedValue;
    }
  }

  return sanitized;
}

export function sanitizeMeta(meta: unknown): Record<string, SanitizedMetaValue> | undefined {
  if (meta === undefined) {
    return undefined;
  }

  const sanitized = sanitizeValue(meta, null, new WeakSet<object>(), MAX_SANITIZE_DEPTH);

  if (sanitized === undefined) {
    return undefined;
  }

  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized;
  }

  return { value: sanitized };
}

function writeLog(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  const formattedMessage = `[${scope}] ${message}`;
  const sanitizedMeta = sanitizeMeta(meta);

  if (sanitizedMeta && Object.keys(sanitizedMeta).length > 0) {
    if (level === 'error') {
      console.error(formattedMessage, sanitizedMeta);
      return;
    }
    console.warn(formattedMessage, sanitizedMeta);
    return;
  }

  if (level === 'error') {
    console.error(formattedMessage);
    return;
  }
  console.warn(formattedMessage);
}

export function logInfo(scope: string, message: string, meta?: unknown): void {
  writeLog('info', scope, message, meta);
}

export function logWarn(scope: string, message: string, meta?: unknown): void {
  writeLog('warn', scope, message, meta);
}

export function logError(scope: string, message: string, meta?: unknown): void {
  writeLog('error', scope, message, meta);
}

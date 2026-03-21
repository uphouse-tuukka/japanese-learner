import { error } from '@sveltejs/kit';
import { generateSpeech } from '$lib/server/tts';
import type { RequestHandler } from './$types';

type RateLimitEntry = {
  date: string;
  count: number;
};

const DAILY_LIMIT = 100;
const rateLimitByUser = new Map<string, RateLimitEntry>();

function getDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function getClientIdentifier(
  request: Request,
  getClientAddress: (() => string) | undefined,
): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ip = forwardedFor.split(',')[0]?.trim();
    if (ip) {
      return ip;
    }
  }

  if (getClientAddress) {
    try {
      return getClientAddress();
    } catch {
      // Fall through to unknown-client fallback.
    }
  }

  return 'unknown-client';
}

function checkAndConsumeRateLimit(userKey: string): boolean {
  const dayKey = getDayKey();
  const existing = rateLimitByUser.get(userKey);

  if (!existing || existing.date !== dayKey) {
    rateLimitByUser.set(userKey, { date: dayKey, count: 1 });
    return true;
  }

  if (existing.count >= DAILY_LIMIT) {
    return false;
  }

  existing.count += 1;
  rateLimitByUser.set(userKey, existing);
  return true;
}

function parseSpeed(rawSpeed: string | null): number {
  if (rawSpeed === null || rawSpeed.trim() === '') {
    return 0.9;
  }

  const speed = Number(rawSpeed);
  if (!Number.isFinite(speed) || speed < 0.25 || speed > 4) {
    throw error(400, 'Query parameter "speed" must be a number between 0.25 and 4.');
  }
  return speed;
}

function buildETag(text: string, voice: string, speed: number): string {
  const content = `${voice}:${speed}:${text}`;
  let hash = 0;
  for (let index = 0; index < content.length; index += 1) {
    hash = (hash * 31 + content.charCodeAt(index)) >>> 0;
  }
  return `W/"${hash.toString(16)}"`;
}

function uint8ToArrayBuffer(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

async function toArrayBuffer(data: unknown): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (data instanceof Uint8Array) {
    return uint8ToArrayBuffer(data);
  }

  if (data instanceof Blob) {
    return data.arrayBuffer();
  }

  if (data instanceof Response) {
    return data.arrayBuffer();
  }

  throw new Error('Unsupported audio data returned from generateSpeech.');
}

export const GET: RequestHandler = async (event) => {
  const text = event.url.searchParams.get('text')?.trim() ?? '';
  const voice = event.url.searchParams.get('voice')?.trim() || 'nova';
  const speed = parseSpeed(event.url.searchParams.get('speed'));

  if (!text) {
    throw error(400, 'Query parameter "text" is required.');
  }

  const userKey = getClientIdentifier(event.request, event.getClientAddress);
  if (!checkAndConsumeRateLimit(userKey)) {
    throw error(429, 'Daily TTS request limit reached (100 requests/day).');
  }

  const etag = buildETag(text, voice, speed);
  if (event.request.headers.get('if-none-match') === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const audioBuffer = await toArrayBuffer(await generateSpeech({ text, voice, speed }));

  return new Response(audioBuffer, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audioBuffer.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: etag,
    },
  });
};

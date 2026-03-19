import { error } from '@sveltejs/kit';
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

function getClientIdentifier(request: Request, getClientAddress: (() => string) | undefined): string {
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

function buildETag(text: string, voice: string): string {
const content = `${voice}:${text}`;
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

async function generateAudio(text: string, voice: string): Promise<ArrayBuffer> {
const modulePath = '$lib/server/' + 'tts';
const ttsModule = (await import(modulePath).catch(() => null)) as
| {
generateSpeech?: (...args: unknown[]) => Promise<unknown>;
  }
| null;

if (!ttsModule || typeof ttsModule.generateSpeech !== 'function') {
throw error(500, 'Server TTS module is not available.');
}

try {
const result = await ttsModule.generateSpeech({ text, voice });
return toArrayBuffer(result);
} catch {
const result = await ttsModule.generateSpeech(text, voice);
return toArrayBuffer(result);
}
}

export const GET: RequestHandler = async (event) => {
const text = event.url.searchParams.get('text')?.trim() ?? '';
const voice = event.url.searchParams.get('voice')?.trim() || 'alloy';

if (!text) {
throw error(400, 'Query parameter "text" is required.');
}

const userKey = getClientIdentifier(event.request, event.getClientAddress);
if (!checkAndConsumeRateLimit(userKey)) {
throw error(429, 'Daily TTS request limit reached (100 requests/day).');
}

const etag = buildETag(text, voice);
if (event.request.headers.get('if-none-match') === etag) {
return new Response(null, {
status: 304,
headers: {
ETag: etag,
'Cache-Control': 'public, max-age=31536000, immutable'
}
});
}

const audioBuffer = await generateAudio(text, voice);

return new Response(audioBuffer, {
headers: {
'Content-Type': 'audio/mpeg',
'Content-Length': String(audioBuffer.byteLength),
'Cache-Control': 'public, max-age=31536000, immutable',
ETag: etag
}
});
};

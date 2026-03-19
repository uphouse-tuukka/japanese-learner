import { playFromUrl, stopAudio, isPlaying } from '$lib/utils/audio';

export interface SpeakOptions {
rate?: number;
pitch?: number;
volume?: number;
voice?: string;
fallbackVoice?: string;
}

let cachedJapaneseVoice: SpeechSynthesisVoice | null | undefined;
let voiceLookupPromise: Promise<SpeechSynthesisVoice | null> | null = null;

function chooseBestJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
if (voices.length === 0) {
return null;
}

const exactLocale = voices.find((voice) => voice.lang.toLowerCase() === 'ja-jp');
if (exactLocale) {
return exactLocale;
}

const japaneseLocale = voices.find((voice) => voice.lang.toLowerCase().startsWith('ja'));
if (japaneseLocale) {
return japaneseLocale;
}

const japaneseName = voices.find((voice) => voice.name.toLowerCase().includes('japanese'));
if (japaneseName) {
return japaneseName;
}

return null;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
if (!isSupported()) {
return null;
}

return window.speechSynthesis;
}

async function getVoicesWithAsyncLoadHandling(timeoutMs = 2000): Promise<SpeechSynthesisVoice[]> {
const synth = getSpeechSynthesis();
if (!synth) {
return [];
}

const immediateVoices = synth.getVoices();
if (immediateVoices.length > 0) {
return immediateVoices;
}

return new Promise((resolve) => {
const timeout = window.setTimeout(() => {
synth.removeEventListener('voiceschanged', onVoicesChanged);
resolve(synth.getVoices());
}, timeoutMs);

const onVoicesChanged = (): void => {
window.clearTimeout(timeout);
synth.removeEventListener('voiceschanged', onVoicesChanged);
resolve(synth.getVoices());
};

synth.addEventListener('voiceschanged', onVoicesChanged);
});
}

export function isSupported(): boolean {
return (
typeof window !== 'undefined' &&
'speechSynthesis' in window &&
typeof SpeechSynthesisUtterance !== 'undefined'
);
}

export async function getJapaneseVoice(): Promise<SpeechSynthesisVoice | null> {
if (!isSupported()) {
cachedJapaneseVoice = null;
return null;
}

if (cachedJapaneseVoice !== undefined) {
return cachedJapaneseVoice;
}

if (!voiceLookupPromise) {
voiceLookupPromise = (async () => {
const voices = await getVoicesWithAsyncLoadHandling();
cachedJapaneseVoice = chooseBestJapaneseVoice(voices);
return cachedJapaneseVoice;
})();
}

try {
return await voiceLookupPromise;
} finally {
voiceLookupPromise = null;
}
}

async function speakViaServerFallback(text: string, fallbackVoice: string): Promise<void> {
const params = new URLSearchParams({ text, voice: fallbackVoice });
await playFromUrl(`/api/tts?${params.toString()}`);
}

export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
const trimmedText = text.trim();
if (!trimmedText) {
return;
}

const rate = options.rate ?? 1;
const pitch = options.pitch ?? 1;
const volume = options.volume ?? 1;
const fallbackVoice = options.fallbackVoice ?? options.voice ?? 'alloy';

if (!isSupported()) {
await speakViaServerFallback(trimmedText, fallbackVoice);
return;
}

const synth = getSpeechSynthesis();
if (!synth) {
await speakViaServerFallback(trimmedText, fallbackVoice);
return;
}

const japaneseVoice = await getJapaneseVoice();
if (!japaneseVoice) {
await speakViaServerFallback(trimmedText, fallbackVoice);
return;
}

stop();

await new Promise<void>((resolve, reject) => {
const utterance = new SpeechSynthesisUtterance(trimmedText);
utterance.voice = japaneseVoice;
utterance.lang = japaneseVoice.lang || 'ja-JP';
utterance.rate = rate;
utterance.pitch = pitch;
utterance.volume = volume;

utterance.onend = () => {
resolve();
};

utterance.onerror = async () => {
try {
await speakViaServerFallback(trimmedText, fallbackVoice);
resolve();
} catch (error) {
reject(error);
}
};

synth.speak(utterance);
});
}

export function stop(): void {
if (isSupported()) {
window.speechSynthesis.cancel();
}
stopAudio();
}

export function isSpeaking(): boolean {
if (isSupported()) {
return window.speechSynthesis.speaking || isPlaying();
}
return isPlaying();
}

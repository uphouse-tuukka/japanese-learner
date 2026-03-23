import { playAudio, stopAudio, isPlaying } from '$lib/utils/audio';
import { PUBLIC_USE_OPENAI_TTS } from '$env/static/public';

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  serverVoice?: string;
  voice?: string;
  fallbackVoice?: string;
  preferBrowser?: boolean;
}

let cachedJapaneseVoice: SpeechSynthesisVoice | null | undefined;
let voiceLookupPromise: Promise<SpeechSynthesisVoice | null> | null = null;
const serverAudioCache = new Map<string, ArrayBuffer>();
const pendingServerAudio = new Map<string, Promise<ArrayBuffer>>();
const useOpenAiTts = PUBLIC_USE_OPENAI_TTS.toLowerCase() === 'true';

function scoreJapaneseVoice(voice: SpeechSynthesisVoice): number {
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;

  if (lang === 'ja-jp') score += 100;
  else if (lang.startsWith('ja')) score += 70;

  if (voice.localService) score += 12;
  if (voice.default) score += 8;
  if (name.includes('kyoko') || name.includes('otoya')) score += 10;
  if (name.includes('haruka') || name.includes('sayaka')) score += 8;
  if (name.includes('japanese') || name.includes('japan')) score += 6;
  if (name.includes('google')) score += 3;

  return score;
}

function chooseBestJapaneseVoice(
  voices: SpeechSynthesisVoice[],
  preferredVoiceName?: string,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }

  if (preferredVoiceName) {
    const preferred = voices.find(
      (voice) => voice.name.toLowerCase() === preferredVoiceName.toLowerCase(),
    );
    if (preferred) {
      return preferred;
    }
  }

  const japaneseVoices = voices.filter(
    (voice) =>
      voice.lang.toLowerCase().startsWith('ja') || voice.name.toLowerCase().includes('japanese'),
  );
  if (japaneseVoices.length === 0) {
    return null;
  }

  japaneseVoices.sort((left, right) => scoreJapaneseVoice(right) - scoreJapaneseVoice(left));
  return japaneseVoices[0] ?? null;
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

export async function getJapaneseVoice(
  preferredVoiceName?: string,
): Promise<SpeechSynthesisVoice | null> {
  if (!isSupported()) {
    cachedJapaneseVoice = null;
    return null;
  }

  if (preferredVoiceName) {
    const voices = await getVoicesWithAsyncLoadHandling();
    return chooseBestJapaneseVoice(voices, preferredVoiceName);
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

async function fetchServerAudio(text: string, voice: string, speed: number): Promise<ArrayBuffer> {
  const cacheKey = `${voice}:${speed}:${text}`;
  const cached = serverAudioCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = pendingServerAudio.get(cacheKey);
  if (pending) {
    return pending;
  }

  const params = new URLSearchParams({ text, voice, speed: String(speed) });
  const request = fetch(`/api/tts?${params.toString()}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Audio request failed with status ${response.status}.`);
      }
      const data = await response.arrayBuffer();
      serverAudioCache.set(cacheKey, data);
      return data;
    })
    .finally(() => {
      pendingServerAudio.delete(cacheKey);
    });

  pendingServerAudio.set(cacheKey, request);
  return request;
}

async function speakViaServer(text: string, voice: string, speed: number): Promise<void> {
  const data = await fetchServerAudio(text, voice, speed);
  await playAudio(data.slice(0));
}

async function speakViaBrowser(
  text: string,
  rate: number,
  pitch: number,
  volume: number,
  fallbackVoiceName?: string,
): Promise<void> {
  if (!isSupported()) {
    throw new Error('Browser speech synthesis is not supported.');
  }

  const synth = getSpeechSynthesis();
  if (!synth) {
    throw new Error('Speech synthesis instance is not available.');
  }

  const japaneseVoice = await getJapaneseVoice(fallbackVoiceName);
  if (!japaneseVoice) {
    throw new Error('No Japanese speech synthesis voice is available.');
  }

  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = japaneseVoice;
    utterance.lang = japaneseVoice.lang || 'ja-JP';
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (speechError) => {
      reject(speechError.error || speechError);
    };

    synth.speak(utterance);
  });
}

export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return;
  }

  const rate = options.rate ?? 0.9;
  const pitch = options.pitch ?? 1.02;
  const volume = options.volume ?? 1;
  const serverVoice = options.serverVoice ?? options.voice ?? 'nova';
  const browserFallbackVoiceName = options.fallbackVoice;
  const useBrowserFirst =
    options.preferBrowser === true ||
    (options.preferBrowser === undefined && trimmedText.length <= 15);

  stop();

  if (!useOpenAiTts) {
    try {
      await speakViaBrowser(trimmedText, rate, pitch, volume, browserFallbackVoiceName);
    } catch (browserError) {
      console.warn('[tts] browser speech failed while OpenAI TTS is disabled', {
        voice: browserFallbackVoiceName,
        rate,
        pitch,
        volume,
        error: browserError,
      });
    }
    return;
  }

  if (useBrowserFirst) {
    try {
      await speakViaBrowser(trimmedText, rate, pitch, volume, browserFallbackVoiceName);
      return;
    } catch (browserError) {
      console.warn('[tts] browser speech failed, falling back to server synthesis', {
        voice: browserFallbackVoiceName,
        rate,
        pitch,
        volume,
        error: browserError,
      });
    }

    await speakViaServer(trimmedText, serverVoice, rate);
    return;
  }

  try {
    await speakViaServer(trimmedText, serverVoice, rate);
    return;
  } catch (serverError) {
    console.warn('[tts] server speech failed, falling back to browser synthesis', {
      voice: serverVoice,
      rate,
      error: serverError,
    });
  }

  await speakViaBrowser(trimmedText, rate, pitch, volume, browserFallbackVoiceName);
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

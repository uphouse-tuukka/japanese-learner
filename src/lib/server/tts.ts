import OpenAI from "openai";
import { config } from "$lib/config";

let openaiClient: OpenAI | null = null;
const ALLOWED_VOICES = new Set([
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
]);

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error("[tts] OPENAI_API_KEY is required for TTS generation");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function validateText(text: string): string {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error("[tts] text is required");
  }
  if (normalized.length > 4000) {
    throw new Error("[tts] text is too long (max 4000 characters)");
  }
  return normalized;
}

function validateVoice(voice: string): string {
  const normalized = voice.trim().toLowerCase();
  if (!normalized || !ALLOWED_VOICES.has(normalized)) {
    throw new Error(`[tts] unsupported voice "${voice}"`);
  }
  return normalized;
}

function validateSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    throw new Error("[tts] speed must be a finite number");
  }
  if (speed < 0.25 || speed > 4) {
    throw new Error("[tts] speed must be between 0.25 and 4");
  }
  return speed;
}

type GenerateSpeechInput = {
  text: string;
  voice?: string;
  speed?: number;
};

export async function generateSpeech(input: GenerateSpeechInput | string, voice = "nova"): Promise<Buffer> {
  const payload = typeof input === "string" ? { text: input, voice } : input;
  const content = validateText(payload.text);
  const selectedVoice = validateVoice(payload.voice ?? "nova");
  const selectedSpeed = validateSpeed(payload.speed ?? 0.9);
  const client = getOpenAiClient();

  console.info("[tts] generating speech", {
    model: "tts-1-hd",
    voice: selectedVoice,
    speed: selectedSpeed,
    textLength: content.length,
  });

  const response = await client.audio.speech.create({
    model: "tts-1-hd",
    voice: selectedVoice,
    input: content,
    response_format: "mp3",
    speed: selectedSpeed,
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

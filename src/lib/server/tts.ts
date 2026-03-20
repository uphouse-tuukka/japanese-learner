import OpenAI from "openai";
import { config } from "$lib/config";

let openaiClient: OpenAI | null = null;

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
  const normalized = voice.trim();
  if (!normalized) {
    throw new Error("[tts] voice is required");
  }
  return normalized;
}

export async function generateSpeech(
  text: string,
  voice = "alloy",
): Promise<Buffer> {
  const content = validateText(text);
  const selectedVoice = validateVoice(voice);
  const client = getOpenAiClient();

  console.info("[tts] generating speech", {
    voice: selectedVoice,
    textLength: content.length,
  });

  const response = await client.audio.speech.create({
    model: "tts-1",
    voice: selectedVoice,
    input: content,
    response_format: "mp3",
  });

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

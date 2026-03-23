import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async () => {
  return {
    dev,
    useOpenAiTts: env.USE_OPENAI_TTS?.toLowerCase() === 'true',
  };
};

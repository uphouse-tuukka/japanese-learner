import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { USE_OPENAI_TTS } from '$env/static/private';

export const load: LayoutServerLoad = async () => {
  return {
    dev,
    useOpenAiTts: USE_OPENAI_TTS?.toLowerCase() === 'true',
  };
};

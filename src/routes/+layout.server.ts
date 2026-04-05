import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  return {
    dev,
    useOpenAiTts: env.USE_OPENAI_TTS?.toLowerCase() === 'true',
    authenticated: locals.authenticated,
    isPortfolio: url.pathname.startsWith('/portfolio/'),
  };
};

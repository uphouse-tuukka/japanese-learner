import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { hasOpenAiApiKey, resolveOpenAiTtsEnabled } from '$lib/config';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  return {
    dev,
    useOpenAiTts: resolveOpenAiTtsEnabled(),
    ttsServerAvailable: hasOpenAiApiKey(),
    authenticated: locals.authenticated,
    isPortfolio: url.pathname.startsWith('/portfolio/'),
  };
};

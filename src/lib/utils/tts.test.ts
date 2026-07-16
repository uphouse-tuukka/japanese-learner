import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPlayAudio, mockStopAudio, mockIsPlaying } = vi.hoisted(() => ({
  mockPlayAudio: vi.fn(),
  mockStopAudio: vi.fn(),
  mockIsPlaying: vi.fn(() => false),
}));

vi.mock('$lib/utils/audio', () => ({
  playAudio: mockPlayAudio,
  stopAudio: mockStopAudio,
  isPlaying: mockIsPlaying,
}));

import { configureOpenAiTts, speak } from '$lib/utils/tts';

type MockUtterance = {
  voice?: SpeechSynthesisVoice;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (error: { error: string }) => void;
};

function installBrowserSpeechThatFails(): void {
  class MockSpeechSynthesisUtterance implements MockUtterance {
    voice?: SpeechSynthesisVoice;
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onstart?: () => void;
    onend?: () => void;
    onerror?: (error: { error: string }) => void;

    constructor(public text: string) {}
  }

  const synth = {
    cancel: vi.fn(),
    speaking: false,
    getVoices: () =>
      [
        {
          name: 'Japanese Voice',
          lang: 'ja-JP',
          localService: true,
          default: true,
        },
      ] as SpeechSynthesisVoice[],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    speak: vi.fn((utterance: MockUtterance) => {
      utterance.onerror?.({ error: 'synthesis-unavailable' });
    }),
  };

  vi.stubGlobal('window', {
    speechSynthesis: synth,
    setTimeout,
    clearTimeout,
  });
  vi.stubGlobal('SpeechSynthesisUtterance', MockSpeechSynthesisUtterance);
}

describe('speak', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    mockPlayAudio.mockReset();
    mockPlayAudio.mockImplementation(async (_audio, onPlaybackStart) => {
      onPlaybackStart?.();
    });
    mockStopAudio.mockReset();
    mockIsPlaying.mockReset();
    mockIsPlaying.mockReturnValue(false);
    installBrowserSpeechThatFails();
  });

  it('falls back to server audio when browser synthesis fails and server TTS is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal('fetch', fetchMock);

    configureOpenAiTts(false, true);

    const onPlaybackStart = vi.fn();
    await speak('こんにちは', {
      preferBrowser: true,
      serverVoice: 'nova',
      onPlaybackStart,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/tts?');
    expect(mockPlayAudio).toHaveBeenCalledTimes(1);
    expect(onPlaybackStart).toHaveBeenCalledOnce();
  });

  it('reports an unavailable playback without changing the existing resolved-call contract', async () => {
    configureOpenAiTts(false, false);
    const onPlaybackError = vi.fn();

    await expect(
      speak('こんにちは', { preferBrowser: true, onPlaybackError }),
    ).resolves.toBeUndefined();

    expect(onPlaybackError).toHaveBeenCalledOnce();
    expect(mockPlayAudio).not.toHaveBeenCalled();
  });
});

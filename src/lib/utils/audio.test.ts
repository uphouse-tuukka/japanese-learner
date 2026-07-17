import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockSource = AudioBufferSourceNode & {
  triggerEnded: () => void;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

function installMockAudioContext(): { getLastSource: () => MockSource | null } {
  let lastSource: MockSource | null = null;

  class MockAudioBufferSourceNode {
    buffer: AudioBuffer | null = null;
    onended: (() => void) | null = null;
    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn(() => {
      this.triggerEnded();
    });

    triggerEnded(): void {
      this.onended?.();
    }
  }

  class MockAudioContext {
    state = 'running';
    destination = {};
    resume = vi.fn();
    close = vi.fn();
    decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
    createBufferSource = vi.fn(() => {
      lastSource = new MockAudioBufferSourceNode() as unknown as MockSource;
      return lastSource;
    });
  }

  vi.stubGlobal('window', {
    AudioContext: MockAudioContext,
  });

  return { getLastSource: () => lastSource };
}

describe('playAudio', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('keeps playback pending until the audio source ends', async () => {
    const { getLastSource } = installMockAudioContext();
    const { isPlaying, playAudio } = await import('$lib/utils/audio');

    let settled = false;
    const playback = playAudio(new Uint8Array([1, 2, 3]).buffer).then(() => {
      settled = true;
    });

    await vi.waitFor(() => {
      expect(getLastSource()).not.toBeNull();
    });

    expect(isPlaying()).toBe(true);
    expect(settled).toBe(false);

    getLastSource()?.triggerEnded();
    await playback;

    expect(settled).toBe(true);
    expect(isPlaying()).toBe(false);
  });

  it('stops active playback when its caller aborts', async () => {
    const { getLastSource } = installMockAudioContext();
    const { isPlaying, playAudio } = await import('$lib/utils/audio');
    const controller = new AbortController();
    const playback = playAudio(new Uint8Array([1, 2, 3]).buffer, undefined, controller.signal);

    await vi.waitFor(() => {
      expect(getLastSource()).not.toBeNull();
    });
    controller.abort();

    await expect(playback).rejects.toMatchObject({ name: 'AbortError' });
    expect(getLastSource()?.stop).toHaveBeenCalledOnce();
    expect(isPlaying()).toBe(false);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAudioRecorder,
  type AudioRecorderDependencies,
  type RecorderLike,
  type RecorderStreamLike,
} from './audio-recorder';

function createHarness() {
  const track = { stop: vi.fn() };
  const stream: RecorderStreamLike = { getTracks: () => [track] };
  const recorder: RecorderLike = {
    state: 'inactive',
    mimeType: 'audio/webm;codecs=opus',
    ondataavailable: null,
    onstop: null,
    onerror: null,
    start: vi.fn(() => {
      recorder.state = 'recording';
    }),
    stop: vi.fn(() => {
      recorder.state = 'inactive';
      recorder.ondataavailable?.({ data: new Blob(['voice-data']) });
      recorder.onstop?.();
    }),
  };
  const dependencies: AudioRecorderDependencies = {
    getUserMedia: vi.fn(async () => stream),
    isTypeSupported: vi.fn((mimeType) => mimeType === 'audio/webm;codecs=opus'),
    createRecorder: vi.fn(() => recorder),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };

  return { dependencies, recorder, stream, track };
}

describe('createAudioRecorder', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts through browser APIs without invoking host timers as object methods', async () => {
    const track = { stop: vi.fn() };
    const stream: RecorderStreamLike = { getTracks: () => [track] };
    const originalSetInterval = globalThis.setInterval;
    const hostSetInterval = function (
      this: typeof globalThis | undefined,
      callback: () => void,
      milliseconds: number,
    ): ReturnType<typeof setInterval> {
      if (this !== globalThis) throw new TypeError('Illegal invocation');
      return originalSetInterval(callback, milliseconds);
    };

    class BrowserMediaRecorder implements RecorderLike {
      static isTypeSupported(mimeType: string): boolean {
        return mimeType === 'audio/webm;codecs=opus';
      }

      state = 'inactive';
      mimeType: string;
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(_stream: RecorderStreamLike, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? 'audio/webm';
      }

      start(): void {
        this.state = 'recording';
      }

      stop(): void {
        this.state = 'inactive';
        this.onstop?.();
      }
    }

    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
    });
    vi.stubGlobal('MediaRecorder', BrowserMediaRecorder);
    vi.stubGlobal('setInterval', hostSetInterval);

    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      onStateChange: vi.fn(),
      onRecordingReady: vi.fn(),
    });

    await controller.start();

    expect(controller.snapshot.status).toBe('recording');
    controller.dispose();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('requests permission only on explicit start and negotiates the preferred MIME type', async () => {
    const { dependencies } = createHarness();
    const states: string[] = [];
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: (snapshot) => states.push(snapshot.status),
      onRecordingReady: vi.fn(),
    });

    expect(dependencies.getUserMedia).not.toHaveBeenCalled();

    await controller.start();

    expect(dependencies.getUserMedia).toHaveBeenCalledTimes(1);
    expect(dependencies.createRecorder).toHaveBeenCalledWith(
      expect.anything(),
      'audio/webm;codecs=opus',
    );
    expect(states).toContain('requesting_permission');
    expect(controller.snapshot.status).toBe('recording');
  });

  it('falls back to MP4 when the browser does not support WebM recording', async () => {
    const { dependencies } = createHarness();
    vi.mocked(dependencies.isTypeSupported).mockImplementation(
      (mimeType) => mimeType === 'audio/mp4',
    );
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady: vi.fn(),
    });

    await controller.start();

    expect(dependencies.createRecorder).toHaveBeenCalledWith(expect.anything(), 'audio/mp4');
  });

  it('reports unsupported browsers without requesting microphone access', async () => {
    const states: string[] = [];
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies: null,
      onStateChange: (snapshot) => states.push(snapshot.status),
      onRecordingReady: vi.fn(),
    });

    await controller.start();

    expect(controller.snapshot.status).toBe('unsupported');
    expect(states).toContain('unsupported');
  });

  it('falls back as unsupported when no approved recording MIME type is available', async () => {
    const { dependencies } = createHarness();
    vi.mocked(dependencies.isTypeSupported).mockReturnValue(false);
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady: vi.fn(),
    });

    await controller.start();

    expect(controller.snapshot).toMatchObject({
      status: 'unsupported',
      errorMessage: 'This browser cannot record a supported WebM or MP4 audio format.',
    });
    expect(dependencies.getUserMedia).not.toHaveBeenCalled();
    expect(dependencies.createRecorder).not.toHaveBeenCalled();
  });

  it('returns recorded audio and releases every media track after a manual stop', async () => {
    const { dependencies, track } = createHarness();
    const onRecordingReady = vi.fn();
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady,
    });

    await controller.start();
    controller.stop();

    expect(onRecordingReady).toHaveBeenCalledWith({
      audio: expect.any(Blob),
      mimeType: 'audio/webm;codecs=opus',
      reason: 'manual',
    });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot.status).toBe('idle');
  });

  it('cancels without producing audio and still releases every media track', async () => {
    const { dependencies, track } = createHarness();
    const onRecordingReady = vi.fn();
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady,
    });

    await controller.start();
    controller.cancel();

    expect(onRecordingReady).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot.status).toBe('idle');
  });

  it('clamps the duration and automatically stops at the enforced limit', async () => {
    vi.useFakeTimers();
    const { dependencies, track } = createHarness();
    const onRecordingReady = vi.fn();
    const controller = createAudioRecorder({
      maxDurationSeconds: 2,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady,
    });

    await controller.start();
    expect(controller.snapshot.maxDurationSeconds).toBe(5);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(onRecordingReady).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onRecordingReady).toHaveBeenCalledWith(expect.objectContaining({ reason: 'auto_stop' }));
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('supports an explicit retry after microphone permission is denied', async () => {
    const { dependencies } = createHarness();
    vi.mocked(dependencies.getUserMedia).mockRejectedValueOnce(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    );
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady: vi.fn(),
    });

    await controller.start();
    expect(controller.snapshot).toMatchObject({
      status: 'error',
      errorMessage: 'Microphone permission was denied. You can retry or continue without credit.',
    });

    controller.retry();
    expect(controller.snapshot.status).toBe('idle');
    await controller.start();

    expect(dependencies.getUserMedia).toHaveBeenCalledTimes(2);
    expect(controller.snapshot.status).toBe('recording');
  });

  it('releases media tracks when disposed during an active recording', async () => {
    const { dependencies, track } = createHarness();
    const onRecordingReady = vi.fn();
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady,
    });

    await controller.start();
    controller.dispose();

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(onRecordingReady).not.toHaveBeenCalled();
  });

  it('keeps recorder errors from submitting audio when a later stop event arrives', async () => {
    const { dependencies, recorder, track } = createHarness();
    const onRecordingReady = vi.fn();
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady,
    });

    await controller.start();
    const delayedStop = recorder.onstop;
    recorder.onerror?.();
    delayedStop?.();

    expect(controller.snapshot).toMatchObject({
      status: 'error',
      errorMessage: 'Recording failed. Please try again.',
    });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(onRecordingReady).not.toHaveBeenCalled();
  });

  it('cancels a pending permission request without starting a recorder later', async () => {
    const { dependencies, stream, track } = createHarness();
    let resolvePermission!: (stream: RecorderStreamLike) => void;
    vi.mocked(dependencies.getUserMedia).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePermission = resolve;
        }),
    );
    const controller = createAudioRecorder({
      maxDurationSeconds: 12,
      dependencies,
      onStateChange: vi.fn(),
      onRecordingReady: vi.fn(),
    });

    const start = controller.start();
    expect(controller.snapshot.status).toBe('requesting_permission');
    controller.cancel();
    resolvePermission(stream);
    await start;

    expect(dependencies.createRecorder).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot.status).toBe('idle');
  });
});

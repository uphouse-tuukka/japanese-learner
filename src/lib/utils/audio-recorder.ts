export const AUDIO_MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
] as const;

export type AudioRecorderStatus =
  | 'idle'
  | 'requesting_permission'
  | 'recording'
  | 'stopping'
  | 'error'
  | 'unsupported';

export type AudioRecorderSnapshot = {
  status: AudioRecorderStatus;
  elapsedSeconds: number;
  maxDurationSeconds: number;
  mimeType: string;
  errorMessage?: string;
};

export type RecorderTrackLike = { stop(): void };
export type RecorderStreamLike = { getTracks(): RecorderTrackLike[] };
export type RecorderLike = {
  state: string;
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};

export type AudioRecorderDependencies = {
  getUserMedia(): Promise<RecorderStreamLike>;
  isTypeSupported(mimeType: string): boolean;
  createRecorder(stream: RecorderStreamLike, mimeType: string): RecorderLike;
  setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
  setInterval(callback: () => void, milliseconds: number): ReturnType<typeof setInterval>;
  clearInterval(timer: ReturnType<typeof setInterval>): void;
};

export type RecordedAudio = {
  audio: Blob;
  mimeType: string;
  reason: 'manual' | 'auto_stop';
};

export type AudioRecorderOptions = {
  maxDurationSeconds: number;
  dependencies?: AudioRecorderDependencies | null;
  onStateChange(snapshot: AudioRecorderSnapshot): void;
  onRecordingReady(recording: RecordedAudio): void;
};

export function clampRecordingDuration(seconds: number): number {
  return Math.min(Math.max(Math.round(seconds), 5), 20);
}

export function negotiateAudioMimeType(isTypeSupported: (mimeType: string) => boolean): string {
  return AUDIO_MIME_TYPE_CANDIDATES.find(isTypeSupported) ?? '';
}

function browserDependencies(): AudioRecorderDependencies | null {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof MediaRecorder === 'undefined'
  ) {
    return null;
  }

  return {
    getUserMedia: () => navigator.mediaDevices.getUserMedia({ audio: true }),
    isTypeSupported: (mimeType) => MediaRecorder.isTypeSupported(mimeType),
    createRecorder: (stream, mimeType) =>
      new MediaRecorder(
        stream as MediaStream,
        mimeType ? { mimeType } : undefined,
      ) as unknown as RecorderLike,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
}

export class AudioRecorderController {
  readonly snapshot: AudioRecorderSnapshot;
  private readonly dependencies: AudioRecorderDependencies | null;
  private stream: RecorderStreamLike | null = null;
  private recorder: RecorderLike | null = null;
  private chunks: Blob[] = [];
  private stopReason: RecordedAudio['reason'] | 'cancel' = 'manual';
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private permissionRequestId = 0;

  constructor(private readonly options: AudioRecorderOptions) {
    this.dependencies =
      options.dependencies === undefined ? browserDependencies() : options.dependencies;
    this.snapshot = {
      status: this.dependencies ? 'idle' : 'unsupported',
      elapsedSeconds: 0,
      maxDurationSeconds: clampRecordingDuration(options.maxDurationSeconds),
      mimeType: '',
    };
    options.onStateChange({ ...this.snapshot });
  }

  private update(patch: Partial<AudioRecorderSnapshot>): void {
    Object.assign(this.snapshot, patch);
    if (!this.disposed) {
      this.options.onStateChange({ ...this.snapshot });
    }
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  private clearTimers(): void {
    if (!this.dependencies) return;
    if (this.stopTimer !== null) {
      this.dependencies.clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.tickTimer !== null) {
      this.dependencies.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private stopRecording(reason: RecordedAudio['reason']): void {
    if (!this.recorder || this.recorder.state === 'inactive') return;
    this.stopReason = reason;
    this.clearTimers();
    this.update({ status: 'stopping' });
    this.recorder.stop();
  }

  async start(): Promise<void> {
    if (this.disposed) return;
    if (!this.dependencies) {
      this.update({ status: 'unsupported' });
      return;
    }
    if (this.snapshot.status !== 'idle' && this.snapshot.status !== 'error') return;

    const mimeType = negotiateAudioMimeType(this.dependencies.isTypeSupported);
    if (!mimeType) {
      this.update({
        status: 'unsupported',
        errorMessage: 'This browser cannot record a supported WebM or MP4 audio format.',
      });
      return;
    }

    const permissionRequestId = ++this.permissionRequestId;
    this.update({ status: 'requesting_permission', errorMessage: undefined });
    try {
      const stream = await this.dependencies.getUserMedia();
      if (this.disposed || permissionRequestId !== this.permissionRequestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.recorder = this.dependencies.createRecorder(this.stream, mimeType);
      const recorder = this.recorder;
      this.chunks = [];
      this.stopReason = 'manual';
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (this.recorder !== recorder) return;
        const reason = this.stopReason;
        this.clearTimers();
        const audio = new Blob(this.chunks, {
          type: recorder.mimeType || mimeType || 'audio/webm',
        });
        this.chunks = [];
        this.recorder = null;
        this.releaseStream();
        this.update({ status: 'idle', elapsedSeconds: 0 });
        if (reason !== 'cancel' && audio.size > 0) {
          this.options.onRecordingReady({
            audio,
            mimeType: audio.type,
            reason,
          });
        }
      };
      recorder.onerror = () => {
        if (this.recorder !== recorder) return;
        this.clearTimers();
        this.recorder = null;
        this.chunks = [];
        this.releaseStream();
        this.update({ status: 'error', errorMessage: 'Recording failed. Please try again.' });
      };
      recorder.start();
      this.update({ status: 'recording', mimeType });
      this.tickTimer = this.dependencies.setInterval(() => {
        this.update({
          elapsedSeconds: Math.min(
            this.snapshot.elapsedSeconds + 1,
            this.snapshot.maxDurationSeconds,
          ),
        });
      }, 1_000);
      this.stopTimer = this.dependencies.setTimeout(
        () => this.stopRecording('auto_stop'),
        this.snapshot.maxDurationSeconds * 1_000,
      );
    } catch (error) {
      if (this.disposed || permissionRequestId !== this.permissionRequestId) return;
      this.clearTimers();
      this.recorder = null;
      this.chunks = [];
      this.releaseStream();
      this.update({
        status: 'error',
        errorMessage:
          error instanceof Error && error.name === 'NotAllowedError'
            ? 'Microphone permission was denied. You can retry or continue without credit.'
            : 'Could not start microphone recording. Please try again.',
      });
    }
  }

  stop(): void {
    this.stopRecording('manual');
  }

  cancel(): void {
    this.permissionRequestId += 1;
    this.stopReason = 'cancel';
    this.clearTimers();
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop();
      return;
    }

    this.recorder = null;
    this.chunks = [];
    this.releaseStream();
    this.update({ status: 'idle', elapsedSeconds: 0 });
  }

  retry(): void {
    this.cancel();
    this.update({ status: 'idle', errorMessage: undefined, mimeType: '' });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
  }
}

export function createAudioRecorder(options: AudioRecorderOptions): AudioRecorderController {
  return new AudioRecorderController(options);
}

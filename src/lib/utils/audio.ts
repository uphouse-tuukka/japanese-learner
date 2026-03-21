let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;
let playing = false;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    audioContext = new AudioContextCtor();
  }

  return audioContext;
}

async function ensureContextReady(): Promise<AudioContext> {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
}

function markStopped(source: AudioBufferSourceNode | null): void {
  if (!source) {
    return;
  }

  source.onended = null;
  source.disconnect();
  if (currentSource === source) {
    currentSource = null;
    playing = false;
  }
}

async function decodeAudio(audioData: ArrayBuffer | Blob): Promise<AudioBuffer> {
  const context = await ensureContextReady();
  const arrayBuffer = audioData instanceof Blob ? await audioData.arrayBuffer() : audioData;
  const copy = arrayBuffer.slice(0);
  return context.decodeAudioData(copy);
}

export async function playAudio(audioData: ArrayBuffer | Blob): Promise<void> {
  const context = await ensureContextReady();
  const buffer = await decodeAudio(audioData);

  stopAudio();

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => {
    markStopped(source);
  };

  currentSource = source;
  playing = true;
  source.start(0);
}

export async function playFromUrl(url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Audio request failed with status ${response.status}.`);
  }

  const data = await response.arrayBuffer();
  await playAudio(data);
}

export function stopAudio(): void {
  if (!currentSource) {
    playing = false;
    return;
  }

  try {
    currentSource.stop();
  } catch {
    // Source may already be stopped.
  }

  markStopped(currentSource);
}

export function isPlaying(): boolean {
  return playing;
}

export async function cleanupAudio(): Promise<void> {
  stopAudio();
  if (audioContext && audioContext.state !== 'closed') {
    await audioContext.close();
  }
  audioContext = null;
}

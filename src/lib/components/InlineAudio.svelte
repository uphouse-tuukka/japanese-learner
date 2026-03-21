<script lang="ts">
  import { onDestroy } from 'svelte';
  import { speak, stop, isSpeaking } from '$lib/utils/tts';

  let { japanese, size = 'sm' }: { japanese: string; size?: 'sm' | 'md' } = $props();

  let status = $state<'idle' | 'loading' | 'playing'>('idle');
  let pollInterval: ReturnType<typeof setInterval>;

  function cleanup() {
    if (pollInterval) clearInterval(pollInterval);
  }

  onDestroy(() => {
    cleanup();
    if (status !== 'idle') {
      stop();
    }
  });

  async function togglePlay() {
    if (status === 'playing' || status === 'loading') {
      stop();
      status = 'idle';
      cleanup();
      return;
    }

    status = 'loading';

    cleanup();
    pollInterval = setInterval(() => {
      if (status === 'loading' && isSpeaking()) {
        status = 'playing';
        clearInterval(pollInterval);
      }
    }, 50);

    try {
      await speak(japanese);
    } catch (e) {
      console.warn('TTS playback failed', e);
    } finally {
      status = 'idle';
      cleanup();
    }
  }

  let label = $derived(
    status === 'playing'
      ? 'Stop pronunciation'
      : status === 'loading'
        ? 'Loading pronunciation'
        : 'Play pronunciation',
  );
</script>

<button
  class="inline-audio-btn {size}"
  class:loading={status === 'loading'}
  class:playing={status === 'playing'}
  onclick={togglePlay}
  aria-label={label}
  title={label}
  type="button"
>
  {#if status === 'loading'}
    <!-- Loading: Minimal Pulse -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="icon"
    >
      <circle cx="12" cy="12" r="10" opacity="0.2" stroke="currentColor" />
      <circle cx="12" cy="12" r="4" class="pulse-dot" fill="currentColor" stroke="none" />
    </svg>
  {:else if status === 'playing'}
    <!-- Playing: Outlined Speaker + Waves -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="icon"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  {:else}
    <!-- Idle: Outlined Speaker -->
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="icon"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    </svg>
  {/if}
</button>

<style>
  .inline-audio-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    line-height: 1;
    vertical-align: middle;
    color: var(--text-usuzumi);
    transition: color var(--duration-fast) var(--ease-out);
    border-radius: 999px;
    position: relative;
    /* Adjust spacing to feel like punctuation */
    margin: 0 0.15em;
  }

  .inline-audio-btn:hover {
    color: var(--accent-shu);
  }

  .inline-audio-btn.loading,
  .inline-audio-btn.playing {
    color: var(--accent-shu);
  }

  /* Size variants - reduced for elegance */
  .sm {
    font-size: 0.85em;
    width: 1em;
    height: 1em;
    /* Optical alignment for inline text */
    transform: translateY(-0.1em);
  }

  .md {
    font-size: 1.1em;
    width: 1em;
    height: 1em;
    transform: translateY(-0.05em);
  }

  /* Icon sizing */
  .icon {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Loading animation */
  .pulse-dot {
    transform-origin: center;
    animation: pulse 1.5s infinite var(--ease-in-out);
  }

  @keyframes pulse {
    0% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.2);
      opacity: 1;
    }
    100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
  }

  /* Focus styles */
  .inline-audio-btn:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--accent-shu);
    border-radius: 4px; /* Slightly squared focus ring */
  }

  /* Tap target compensation */
  .sm::after,
  .md::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    min-width: 44px;
    min-height: 44px;
  }
</style>

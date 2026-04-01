<script lang="ts">
  import { onDestroy } from 'svelte';
  import { isSpeaking, speak, stop } from '$lib/utils/tts';
  import type { MissionTurn } from '$lib/types';

  let { turn, characterName, characterEmoji, isCurrentTurn, turnIndex } = $props<{
    turn: MissionTurn;
    characterName: string;
    characterEmoji: string;
    isCurrentTurn: boolean;
    turnIndex: number;
  }>();

  let audioState = $state<'idle' | 'loading' | 'playing'>('idle');
  let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

  function clearPoll(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  onDestroy(() => {
    clearPoll();
    if (audioState !== 'idle') {
      stop();
    }
  });

  async function playLine(): Promise<void> {
    if (audioState === 'loading' || audioState === 'playing') {
      stop();
      audioState = 'idle';
      clearPoll();
      return;
    }

    audioState = 'loading';
    clearPoll();

    pollInterval = setInterval(() => {
      if (audioState === 'loading' && isSpeaking()) {
        audioState = 'playing';
      }
      if (audioState === 'playing' && !isSpeaking()) {
        audioState = 'idle';
      }
    }, 60);

    try {
      await speak(turn.npcDialogue.japanese, { preferBrowser: true });
    } finally {
      audioState = 'idle';
      clearPoll();
    }
  }
</script>

<article class="turn" class:current={isCurrentTurn} aria-label={`Turn ${turnIndex + 1}`}>
  <span class="dot" aria-hidden="true"></span>

  <div class="content">
    <div class="speaker-row">
      <div class="speaker-left">
        <span class="avatar" aria-hidden="true">{characterEmoji}</span>
        <span class="speaker-name">{characterName}</span>
      </div>

      <button type="button" class="audio-btn" onclick={playLine} aria-label="Play audio">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
        </svg>
      </button>
    </div>

    <p class="jp">{turn.npcDialogue.japanese}</p>
    <p class="romaji">{turn.npcDialogue.romaji}</p>

    {#if turn.userResponse}
      <div class="user-response">
        <p class="user-jp">{turn.userResponse.japanese}</p>
        {#if turn.userResponse.romaji}
          <p class="user-romaji">{turn.userResponse.romaji}</p>
        {/if}
      </div>
    {/if}

    {#if turn.feedback}
      <p class="feedback" class:ok={turn.feedback.correct}>
        {turn.feedback.correct ? '✓ ' : '✗ '}{turn.feedback.message}
      </p>
    {/if}
  </div>
</article>

<style>
  .turn {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--space-3);
  }

  .dot {
    width: 6px;
    height: 6px;
    margin-top: var(--space-4);
    border-radius: 999px;
    background: var(--accent-matcha);
    box-shadow: 0 0 0 2px var(--bg-shoji);
  }

  .turn.current .dot {
    width: 8px;
    height: 8px;
    background: var(--accent-shu);
    box-shadow: 0 0 0 4px var(--accent-shu-wash);
  }

  .content {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    background: var(--bg-shoji);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-1);
  }

  .turn.current .content {
    border-left: 4px solid var(--accent-shu);
    box-shadow: var(--shadow-card);
    padding: var(--space-4);
  }

  .speaker-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
  }

  .speaker-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: var(--bg-washi);
    border: 1px solid var(--border-light);
    font-size: var(--text-base);
  }

  .turn.current .avatar {
    width: 36px;
    height: 36px;
    background: var(--accent-shu-wash);
    border-color: var(--accent-shu-soft);
  }

  .speaker-name {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
    letter-spacing: var(--tracking-wide);
  }

  .audio-btn {
    min-height: 1.75rem;
    height: 1.75rem;
    padding: 0 var(--space-2);
    border-radius: 999px;
    border: 1px solid var(--border-light);
    background: var(--bg-washi);
    color: var(--text-usuzumi);
  }

  .audio-btn:hover {
    border-color: var(--accent-shu-soft);
    color: var(--accent-shu);
  }

  .jp,
  .romaji,
  .user-jp,
  .user-romaji,
  .feedback {
    margin: 0;
  }

  .jp {
    font-size: var(--text-base);
    color: var(--text-sumi);
  }

  .turn.current .jp {
    font-size: var(--text-xl);
    line-height: var(--leading-tight);
  }

  .romaji {
    font-size: var(--text-sm);
    color: var(--text-usuzumi);
  }

  .turn.current .romaji {
    font-size: var(--text-sm);
  }

  .user-response {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
    border-top: 1px solid var(--border-light);
    display: grid;
    gap: var(--space-1);
  }

  .user-jp {
    font-size: var(--text-sm);
    color: var(--text-bokashi);
  }

  .user-romaji {
    font-size: var(--text-xs);
    color: var(--text-usuzumi);
  }

  .feedback {
    font-size: var(--text-sm);
    color: var(--accent-shu);
  }

  .feedback.ok {
    color: var(--accent-matcha);
  }
</style>

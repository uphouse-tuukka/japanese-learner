<script lang="ts">
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import RichJapaneseText from '$lib/components/RichJapaneseText.svelte';
  import type { KeyPhrase, SessionMiniLesson } from '$lib/types';

  type PhraseCardData = Pick<KeyPhrase, 'japanese' | 'romaji' | 'english'> &
    Partial<Pick<KeyPhrase, 'usage'>> &
    Partial<Pick<SessionMiniLesson, 'note'>>;

  let {
    phrase,
    detail,
    audioSize = 'md',
  }: {
    phrase: PhraseCardData;
    detail?: string;
    audioSize?: 'sm' | 'md';
  } = $props();

  const detailText = $derived(detail ?? phrase.usage ?? phrase.note ?? '');
</script>

<article class="key-phrase-card">
  <p class="jp">
    {phrase.japanese}
    <InlineAudio japanese={phrase.japanese} size={audioSize} />
  </p>
  {#if phrase.romaji}
    <p class="romaji">{phrase.romaji}</p>
  {/if}
  <p class="en">{phrase.english}</p>
  {#if detailText}
    <p class="usage"><RichJapaneseText text={detailText} /></p>
  {/if}
</article>

<style>
  .key-phrase-card {
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    display: grid;
    gap: var(--space-1);
  }

  .jp {
    font-size: var(--text-xl);
    margin: 0;
  }

  .romaji,
  .en,
  .usage {
    margin: 0;
  }

  .romaji {
    color: var(--text-usuzumi);
  }

  .usage {
    font-size: var(--text-sm);
  }
</style>

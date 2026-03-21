<script lang="ts">
  import InlineAudio from '$lib/components/InlineAudio.svelte';
  import { parseJapaneseSegments, type Segment } from '$lib/utils/japanese';

  let { text, audioSize = 'sm' }: { text: string; audioSize?: 'sm' | 'md' } = $props();

  let segments = $derived<Segment[]>(parseJapaneseSegments(text ?? ''));
  let hasJapanese = $derived(segments.some((segment) => segment.type === 'japanese'));
</script>

{#if text}
  {#if hasJapanese}
    {#each segments as segment, index (`${index}-${segment.content}`)}
      {#if segment.type === 'text'}
        {segment.content}
      {:else}
        <span class="jp-segment">
          <span class="text-japanese">{segment.japanese}</span>{#if segment.romaji}
            ({segment.romaji}){/if}<InlineAudio japanese={segment.japanese} size={audioSize} />
        </span>
      {/if}
    {/each}
  {:else}
    {text}
  {/if}
{/if}

<style>
  .jp-segment {
    display: inline;
  }

  .text-japanese {
    font-feature-settings: 'palt';
  }
</style>

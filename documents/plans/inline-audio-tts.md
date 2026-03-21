# Inline Audio Buttons for Japanese Text

**Created**: 2026-03-21
**Status**: Planned
**Priority**: High — most requested feature

## Problem

Japanese text appears throughout the app (exercises, summaries, feedback) but users can only hear pronunciation in the dedicated Listening exercise type. Every instance of Japanese text should have an inline audio button so users can hear how it sounds.

## Recommended Approach: Hybrid (Auto-detection + Structured data)

### Why hybrid?

- **Exercises** already have structured `japanese` + `romaji` fields → use directly
- **Summaries/feedback** contain Japanese inline in free text like "こんにちは (konnichiwa)" → need auto-detection
- No AI prompt changes needed — the AI already outputs Japanese with romaji in parentheses

### TTS Strategy

| Text length                       | Method              | Rationale                                       |
| --------------------------------- | ------------------- | ----------------------------------------------- |
| Single words / ≤15 chars Japanese | Browser TTS         | Instant, free, good enough for individual words |
| Sentences / >15 chars Japanese    | Server TTS (OpenAI) | Better pronunciation quality for longer phrases |

The `speak()` function in `src/lib/utils/tts.ts` already tries server first → browser fallback. For inline buttons on short text, we should try browser first → server fallback (reverse priority) to avoid latency and API costs for every word click.

## Implementation Steps

### Step 1: Create Japanese text detection utility

**File**: `src/lib/utils/japanese.ts` (NEW)

- `containsJapanese(text: string): boolean` — detect hiragana (U+3040–309F), katakana (U+30A0–30FF), kanji (U+4E00–9FFF)
- `parseJapaneseSegments(text: string): Segment[]` — parse a string into segments of `{ type: 'text' | 'japanese', content: string, japanese?: string, romaji?: string }`
- Should handle the AI's output pattern: `こんにちは (konnichiwa)` → extract Japanese + romaji as a unit
- Regex pattern: match Japanese chars optionally followed by ` (romaji)` in parentheses

### Step 2: Create InlineAudio Svelte component

**File**: `src/lib/components/InlineAudio.svelte` (NEW)

- Props: `japanese: string` (the Japanese text to speak), `size?: 'sm' | 'md'`
- Renders a small 🔊 speaker button inline
- On click: calls `speak()` with the Japanese text
- Shows loading/playing state (icon change or subtle animation)
- Uses browser TTS for short text, server for longer
- Compact: should not disrupt text flow (inline-flex, small icon)

### Step 3: Create RichJapaneseText component

**File**: `src/lib/components/RichJapaneseText.svelte` (NEW)

- Props: `text: string` (raw text that may contain Japanese)
- Uses `parseJapaneseSegments()` to split the text
- Renders plain text segments as-is
- Renders Japanese segments as: `<span class="japanese-inline">こんにちは (konnichiwa) <InlineAudio japanese="こんにちは" size="sm" /></span>`
- This component replaces `{item}` in any list that may contain Japanese

### Step 4: Update SessionSummary.svelte

**File**: `src/lib/components/SessionSummary.svelte` (MODIFY)

- Replace `{item}` in strengths/weaknesses/nextSteps lists with `<RichJapaneseText text={item} />`
- Replace `{summary.summary}` with `<RichJapaneseText text={summary.summary} />`

### Step 5: Update exercise components

**Files**: `src/lib/components/exercises/*.svelte` (MODIFY)

- Add `<InlineAudio>` button next to Japanese text in each exercise component:
  - **MultipleChoiceExercise**: next to `{exercise.japanese}`
  - **TranslationExercise**: next to `{exercise.japanese}` (ja_to_en mode)
  - **FillBlankExercise**: next to `{exercise.sentence}` — also add missing romaji display
  - **ReadingExercise**: next to `{exercise.passage}` — also add missing romaji display
  - **ReorderExercise**: next to Japanese tokens
  - **ListeningExercise**: already has audio — no change needed

### Step 6 (Optional): History page

**File**: `src/routes/history/+page.svelte` (MODIFY)

- If session summaries are ever shown in detail on history, use `<RichJapaneseText>` there too

## Component Architecture

```
RichJapaneseText (parses free text)
  └─ InlineAudio (small 🔊 button)
       └─ speak() from tts.ts
            ├─ Browser TTS (short text, ≤15 chars)
            └─ Server TTS (longer text, >15 chars)
```

## Open Questions

1. Should the audio button also appear in the progress journal if we ever display it?
2. Do we want a "play all" button that reads an entire summary section aloud?
3. Should we cache browser TTS somehow, or is it fast enough not to matter?

## Files Summary

| Action | File                                                         |
| ------ | ------------------------------------------------------------ |
| CREATE | `src/lib/utils/japanese.ts`                                  |
| CREATE | `src/lib/components/InlineAudio.svelte`                      |
| CREATE | `src/lib/components/RichJapaneseText.svelte`                 |
| MODIFY | `src/lib/components/SessionSummary.svelte`                   |
| MODIFY | `src/lib/components/exercises/MultipleChoiceExercise.svelte` |
| MODIFY | `src/lib/components/exercises/TranslationExercise.svelte`    |
| MODIFY | `src/lib/components/exercises/FillBlankExercise.svelte`      |
| MODIFY | `src/lib/components/exercises/ReadingExercise.svelte`        |
| MODIFY | `src/lib/components/exercises/ReorderExercise.svelte`        |

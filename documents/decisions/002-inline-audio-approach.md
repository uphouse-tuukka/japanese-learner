# Decision 002: Inline Audio Approach

**Date**: 2026-03-21
**Status**: Decided — Hybrid (auto-detection for free text + structured data for exercises)

## Context

Users need to hear Japanese pronunciation for every Japanese word/phrase in the app, not just in Listening exercises.

## Options Considered

### A) AI marks text with special tokens

The AI wraps Japanese text in tokens like `{{tts:こんにちは:konnichiwa}}` and the frontend parses them.

- ✅ Explicit, precise control
- ❌ Requires changing all AI prompts
- ❌ Increases token output cost
- ❌ Fragile if AI forgets or malforms tokens

### B) Frontend auto-detects Japanese characters

Use Unicode regex (hiragana/katakana/kanji ranges) to find Japanese text and add audio buttons.

- ✅ No AI changes needed
- ✅ Works retroactively on all existing content
- ✅ Zero additional token cost
- ❌ Might occasionally misidentify text
- ❌ Harder to pair with romaji automatically

### C) Hybrid: Auto-detection for free text + structured data for exercises

Exercises already have `japanese` and `romaji` as separate fields → add audio buttons directly. For free text (summaries, feedback), auto-detect the `Japanese (romaji)` pattern the AI already outputs.

- ✅ Best of both worlds
- ✅ No AI prompt changes
- ✅ No additional token cost
- ✅ Leverages existing data structure
- ✅ Auto-detection pattern is reliable (AI consistently outputs `Japanese (romaji)`)

## Decision

**Option C: Hybrid approach.** No AI changes needed. Browser TTS for short text (≤15 chars), server TTS for longer phrases.

## Rationale

- Zero additional cost — no prompt changes, no extra AI output
- The AI already consistently formats Japanese as `こんにちは (konnichiwa)` — this is a reliable pattern to parse
- Exercise components already have structured Japanese + romaji fields to use directly
- Browser TTS is acceptable for single words, avoiding API cost per click

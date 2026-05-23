import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const exerciseDir = resolve(repoRoot, 'src/lib/components/exercises');
const appCss = readFileSync(resolve(repoRoot, 'src/app.css'), 'utf8');

function readExerciseComponent(path: string): string {
  return readFileSync(path, 'utf8');
}

function firstPartyExerciseComponents(): string[] {
  return readdirSync(exerciseDir)
    .filter((entry) => entry.endsWith('Exercise.svelte'))
    .map((entry) => join(exerciseDir, entry))
    .sort();
}

function styleBlocks(content: string): string {
  return Array.from(content.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/g))
    .map((match) => match[1])
    .join('\n');
}

function definedAppTokens(): Set<string> {
  return new Set(Array.from(appCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)).map((match) => match[1]));
}

describe('exercise UI contract', () => {
  it('renders every first-party exercise through the shared exercise frame', () => {
    const missingFrame = firstPartyExerciseComponents()
      .filter((path) => !readExerciseComponent(path).includes('ExerciseFrame'))
      .map((path) => basename(path));

    expect(missingFrame).toEqual([]);
  });

  it('does not use raw hex colours in exercise component styles', () => {
    const rawColourUsages = firstPartyExerciseComponents().flatMap((path) => {
      const styles = styleBlocks(readExerciseComponent(path));
      const matches = Array.from(styles.matchAll(/#[0-9a-f]{3,8}\b/gi)).map((match) => match[0]);
      return matches.map((match) => `${basename(path)}: ${match}`);
    });

    expect(rawColourUsages).toEqual([]);
  });

  it('does not use fallback syntax for app-owned design tokens', () => {
    const fallbackTokenUsages = firstPartyExerciseComponents().flatMap((path) => {
      const styles = styleBlocks(readExerciseComponent(path));
      const matches = Array.from(styles.matchAll(/var\(\s*(--[a-z0-9-]+)\s*,/gi)).map(
        (match) => match[1],
      );
      return matches.map((match) => `${basename(path)}: ${match}`);
    });

    expect(fallbackTokenUsages).toEqual([]);
  });

  it('uses only design tokens defined in src/app.css', () => {
    const appTokens = definedAppTokens();
    const undefinedTokenUsages = firstPartyExerciseComponents().flatMap((path) => {
      const styles = styleBlocks(readExerciseComponent(path));
      const tokens = Array.from(styles.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)).map(
        (match) => match[1],
      );
      return tokens
        .filter((token) => !appTokens.has(token))
        .map((token) => `${basename(path)}: ${token}`);
    });

    expect(undefinedTokenUsages).toEqual([]);
  });

  it('keeps TranslationExercise on global/shared button classes', () => {
    const translation = readExerciseComponent(join(exerciseDir, 'TranslationExercise.svelte'));

    expect(translation).not.toMatch(/\b(?:hint-btn|check-btn|continue-btn)\b/);
  });

  it('keeps SessionRenderer error styling tokenised', () => {
    const path = resolve(repoRoot, 'src/lib/components/SessionRenderer.svelte');
    expect(existsSync(path)).toBe(true);

    const styles = styleBlocks(readFileSync(path, 'utf8'));
    expect(styles).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('keeps the reading passage and romaji grouped before the question', () => {
    const reading = readExerciseComponent(join(exerciseDir, 'ReadingExercise.svelte'));

    expect(reading).toContain('class="reading-prompt"');
    expect(reading).toContain('class="reading-passage"');
    expect(reading).toContain('class="reading-question"');
    expect(reading.indexOf('class="reading-passage"')).toBeLessThan(
      reading.indexOf('class="reading-question"'),
    );
  });

  it('keeps listening playback controls secondary to answer submission', () => {
    const listening = readExerciseComponent(join(exerciseDir, 'ListeningExercise.svelte'));

    expect(listening).toContain('class="audio-panel"');
    expect(listening).toMatch(/class="btn btn-secondary"[\s\S]*onclick=\{playAudio\}/);
    expect(listening).not.toMatch(/class="btn btn-primary"[\s\S]*onclick=\{playAudio\}/);
  });

  it('keeps active listening playback labelled as playing, not replay', () => {
    const listening = readExerciseComponent(join(exerciseDir, 'ListeningExercise.svelte'));

    expect(listening).toContain('Playing audio…');
    expect(listening).not.toContain("speaking ? 'Replay audio'");
  });

  it('keeps speaking controls stable before recording status copy', () => {
    const speaking = readExerciseComponent(join(exerciseDir, 'SpeakingExercise.svelte'));

    expect(speaking).not.toContain('Romaji:');
    expect(speaking).toContain('class="speaking-status"');
    expect(speaking.indexOf('class="exercise-actions speaking-actions"')).toBeLessThan(
      speaking.indexOf('class="speaking-status"'),
    );
  });

  it('prevents speaking cancel from submitting recorder output for grading', () => {
    const speaking = readExerciseComponent(join(exerciseDir, 'SpeakingExercise.svelte'));

    expect(speaking).toContain("recordingStopIntent = 'cancel'");
    expect(speaking).toMatch(
      /if \(shouldSubmitStoppedRecording\(stopIntent, audio\.size\)\) \{\s*void submitAudio\(audio\);/,
    );
  });
});

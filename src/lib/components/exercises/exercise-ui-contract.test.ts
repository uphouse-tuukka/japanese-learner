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
});

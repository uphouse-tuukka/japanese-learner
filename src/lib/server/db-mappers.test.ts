import { describe, expect, it } from 'vitest';
import type { Exercise } from '$lib/types';
import {
  asNumber,
  mapPortfolioSessionRow,
  mapSessionRow,
  mapTokenUsageRow,
  mapUserRow,
  parseExercise,
  toPercent,
} from './db-mappers';

describe('asNumber', () => {
  it('normalizes finite numbers, numeric strings, and bigints', () => {
    expect(asNumber(12)).toBe(12);
    expect(asNumber('12.5')).toBe(12.5);
    expect(asNumber(BigInt(7))).toBe(7);
  });

  it('uses the fallback for non-finite or non-numeric values', () => {
    expect(asNumber(Number.NaN, 4)).toBe(4);
    expect(asNumber('not-a-number', 4)).toBe(4);
    expect(asNumber(null, 4)).toBe(4);
  });
});

describe('toPercent', () => {
  it('rounds correct answers into a whole-number percentage', () => {
    expect(toPercent(2, 3)).toBe(67);
  });

  it('returns 0 when the total count is not positive', () => {
    expect(toPercent(1, 0)).toBe(0);
    expect(toPercent(1, -3)).toBe(0);
  });
});

describe('db row mappers', () => {
  it('maps a user row into the public User shape', () => {
    expect(
      mapUserRow({
        id: 'user-1',
        name: 'Aki',
        level: 'beginner',
        japanese_writing_enabled: '1',
        created_at: '2025-05-06T12:00:00.000Z',
        updated_at: '2025-05-07T08:30:00.000Z',
        last_active_at: null,
        progress_journal: 'Practiced greetings.',
      }),
    ).toEqual({
      id: 'user-1',
      name: 'Aki',
      level: 'beginner',
      japaneseWritingEnabled: true,
      createdAt: '2025-05-06T12:00:00.000Z',
      updatedAt: '2025-05-07T08:30:00.000Z',
      lastActiveAt: null,
      progressJournal: 'Practiced greetings.',
    });
  });

  it('maps a session row into the public Session shape', () => {
    expect(
      mapSessionRow({
        id: 'session-1',
        user_id: 'user-1',
        mode: 'ai',
        status: 'completed',
        model: '',
        token_input: '12',
        token_output: BigInt(7),
        summary: 'Good work.',
        created_at: '2025-05-06T12:00:00.000Z',
        completed_at: '2025-05-06T12:20:00.000Z',
      }),
    ).toEqual({
      id: 'session-1',
      userId: 'user-1',
      mode: 'ai',
      status: 'completed',
      model: null,
      tokenInput: 12,
      tokenOutput: 7,
      summary: 'Good work.',
      createdAt: '2025-05-06T12:00:00.000Z',
      completedAt: '2025-05-06T12:20:00.000Z',
    });
  });

  it('maps a token usage row into the public TokenUsage shape', () => {
    expect(
      mapTokenUsageRow({
        id: 'tok-1',
        user_id: 'user-1',
        session_id: '',
        model: 'gpt-5-mini',
        tokens_in: '30',
        tokens_out: 10,
        tokens_total: BigInt(40),
        created_at: '2025-05-06T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'tok-1',
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5-mini',
      tokensIn: 30,
      tokensOut: 10,
      tokensTotal: 40,
      createdAt: '2025-05-06T12:00:00.000Z',
    });
  });

  it('maps a portfolio session row into the existing DB facade shape', () => {
    expect(
      mapPortfolioSessionRow({
        id: 'pca-1',
        cookie_id: 'cookie-1',
        ip_hash: 'ip-hash',
        status: 'started',
        started_at: '2025-05-06T12:00:00.000Z',
        completed_at: null,
        expires_at: '2025-05-06T13:00:00.000Z',
        scenario: 'hotel check-in',
        lesson: '',
        exercises: '[{"id":"exercise-1"}]',
        answers: null,
        current_step: '3',
        summary: '',
        supports_browser_voice: '1',
      }),
    ).toEqual({
      id: 'pca-1',
      cookieId: 'cookie-1',
      ipHash: 'ip-hash',
      status: 'started',
      startedAt: '2025-05-06T12:00:00.000Z',
      completedAt: null,
      expiresAt: '2025-05-06T13:00:00.000Z',
      scenario: 'hotel check-in',
      lesson: null,
      exercises: '[{"id":"exercise-1"}]',
      answers: null,
      currentStep: 3,
      summary: null,
      supportsBrowserVoice: true,
    });
  });
});

describe('parseExercise', () => {
  const exercise: Exercise = {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Greeting choice',
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    englishContext: 'hello',
    tags: ['greetings'],
    difficulty: 1,
    question: 'Choose the greeting.',
    choices: ['こんにちは', 'さようなら'],
    correctAnswer: 'こんにちは',
    explanation: 'こんにちは (konnichiwa) is a common greeting.',
  };

  it('parses stored exercise JSON', () => {
    expect(parseExercise(JSON.stringify(exercise))).toEqual(exercise);
  });

  it('throws for missing stored exercise JSON', () => {
    expect(() => parseExercise('')).toThrow('[db] Missing exercise content_json');
    expect(() => parseExercise(null)).toThrow('[db] Missing exercise content_json');
  });
});

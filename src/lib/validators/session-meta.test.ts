import { describe, expect, it } from 'vitest';
import { parseSessionMeta } from './session-meta';

function validSessionMeta(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    summaryText: 'You practiced restaurant ordering.',
    category: 'food_dining',
    topic: 'restaurant_ordering',
    accuracy: 83,
    strengths: ['polite requests', 'listening'],
    weaknesses: ['counters'],
    nextSteps: ['review counters', 'try a longer order'],
    handoffNotes: ['continue with menu questions'],
    exerciseTypes: ['multiple_choice', 'translation'],
    keyPhrases: ['おすすめは何ですか'],
    culturalNote: 'Servers may repeat the order back.',
    miniLesson: {
      kind: 'related_phrase',
      japanese: 'おすすめは何ですか',
      romaji: 'osusume wa nan desu ka',
      english: 'What do you recommend?',
      note: 'Useful when choosing from a menu.',
    },
    hadLevelUpRecommendation: true,
    ...overrides,
  });
}

describe('parseSessionMeta', () => {
  it('parses a valid full SessionMeta payload', () => {
    const parsed = parseSessionMeta(validSessionMeta());

    expect(parsed).toEqual({
      summaryText: 'You practiced restaurant ordering.',
      category: 'food_dining',
      topic: 'restaurant_ordering',
      accuracy: 83,
      strengths: ['polite requests', 'listening'],
      weaknesses: ['counters'],
      nextSteps: ['review counters', 'try a longer order'],
      handoffNotes: ['continue with menu questions'],
      exerciseTypes: ['multiple_choice', 'translation'],
      keyPhrases: ['おすすめは何ですか'],
      culturalNote: 'Servers may repeat the order back.',
      miniLesson: {
        kind: 'related_phrase',
        japanese: 'おすすめは何ですか',
        romaji: 'osusume wa nan desu ka',
        english: 'What do you recommend?',
        note: 'Useful when choosing from a menu.',
      },
      hadLevelUpRecommendation: true,
    });
  });

  it('returns null when required fields are missing', () => {
    expect(parseSessionMeta(validSessionMeta({ topic: undefined }))).toBeNull();
    expect(parseSessionMeta(validSessionMeta({ exerciseTypes: undefined }))).toBeNull();
  });

  it('returns null for malformed JSON or empty input', () => {
    expect(parseSessionMeta('{not-json')).toBeNull();
    expect(parseSessionMeta(null)).toBeNull();
    expect(parseSessionMeta(undefined)).toBeNull();
    expect(parseSessionMeta('')).toBeNull();
  });

  it('preserves a null miniLesson', () => {
    expect(parseSessionMeta(validSessionMeta({ miniLesson: null }))?.miniLesson).toBeNull();
  });

  it('normalizes an invalid miniLesson to undefined', () => {
    expect(
      parseSessionMeta(
        validSessionMeta({
          miniLesson: {
            kind: 'related_phrase',
            japanese: 'おすすめは何ですか',
            english: 'What do you recommend?',
            note: 'Missing romaji makes it invalid.',
          },
        }),
      )?.miniLesson,
    ).toBeUndefined();
  });

  it('sanitizes nextSteps and handoffNotes consistently with current route behavior', () => {
    const parsed = parseSessionMeta(
      validSessionMeta({
        nextSteps: [' review counters ', '', 42],
        handoffNotes: [' continue with menu questions ', null, ''],
      }),
    );

    expect(parsed?.nextSteps).toEqual(['review counters', '42']);
    expect(parsed?.handoffNotes).toEqual(['continue with menu questions', 'null']);
  });

  it('omits empty nextSteps and handoffNotes arrays', () => {
    const parsed = parseSessionMeta(validSessionMeta({ nextSteps: [], handoffNotes: [] }));

    expect(parsed?.nextSteps).toBeUndefined();
    expect(parsed?.handoffNotes).toBeUndefined();
  });
});

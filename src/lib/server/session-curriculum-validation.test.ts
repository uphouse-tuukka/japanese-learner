import { describe, expect, it } from 'vitest';
import { validateGeneratedSessionPlan } from '$lib/server/session-curriculum-validation';
import type { CoverageEvidence } from '$lib/server/session-coverage-evidence';
import type { KeyPhrase, SessionPlan } from '$lib/types';

const baseCoverage = {
  source: {
    totalCompletedAiSessions: 2,
    parseableCompletedAiSessions: 2,
    ignoredCompletedAiSessions: 0,
  },
  categoryRotation: {
    currentCategory: 'food_dining',
    currentCategoryStreak: 2,
    selectedCategory: 'greetings_basics',
    selectionReason: 'rotated_after_two_session_streak',
    mustRotate: false,
    allowedCategories: ['greetings_basics', 'transport'],
    preferredCategories: ['greetings_basics'],
    blockedCategories: ['food_dining'],
  },
  coveredCategories: [],
  coveredTopics: [
    {
      identity: 'ordering food',
      topic: 'Ordering food',
      category: 'food_dining',
      count: 1,
      sessionIds: ['session-food'],
      firstSeenAt: '2026-05-20T08:00:00.000Z',
      lastSeenAt: '2026-05-20T08:00:00.000Z',
    },
  ],
  coveredKeyPhrases: [
    {
      primaryIdentity: 'ja:すみません',
      identities: ['ja:すみません', 'romaji:sumimasen'],
      display: 'すみません (sumimasen)',
      japanese: 'すみません',
      romaji: 'sumimasen',
      english: 'excuse me',
      usage: 'Get attention politely.',
      category: 'greetings_basics',
      topicIdentity: 'basic greetings',
      topic: 'Basic greetings',
      count: 1,
      sessionIds: ['session-greetings'],
      firstSeenAt: '2026-05-21T08:00:00.000Z',
      lastSeenAt: '2026-05-21T08:00:00.000Z',
    },
    {
      primaryIdentity: 'ja:ください',
      identities: ['ja:ください', 'romaji:kudasai'],
      display: 'ください (kudasai)',
      japanese: 'ください',
      romaji: 'kudasai',
      english: 'please give me',
      usage: 'Request an item.',
      category: 'food_dining',
      topicIdentity: 'ordering food',
      topic: 'Ordering food',
      count: 1,
      sessionIds: ['session-food'],
      firstSeenAt: '2026-05-20T08:00:00.000Z',
      lastSeenAt: '2026-05-20T08:00:00.000Z',
    },
  ],
  reviewCandidates: [],
  promptSnapshot: {} as CoverageEvidence['promptSnapshot'],
} as CoverageEvidence;

function phrase(input: Partial<KeyPhrase>): KeyPhrase {
  return {
    japanese: input.japanese ?? 'こんにちは',
    romaji: input.romaji ?? 'konnichiwa',
    english: input.english ?? 'hello',
    usage: input.usage ?? 'Use as a greeting.',
  };
}

function plan(
  overrides: {
    category?: string;
    topic?: string;
    keyPhrases?: KeyPhrase[];
  } = {},
): SessionPlan {
  return {
    id: 'session-new',
    userId: 'user-1',
    mode: 'ai',
    createdAt: '2026-05-26T08:00:00.000Z',
    model: 'gpt-5.4',
    lesson: {
      topic: overrides.topic ?? 'First shop greeting',
      category: overrides.category ?? 'greetings_basics',
      explanation: 'Practice a fresh greeting situation.',
      culturalNote: 'Greet staff politely.',
      keyPhrases: overrides.keyPhrases ?? [
        phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' }),
      ],
    },
    exercises: [],
    tokenUsage: { input: 10, output: 20 },
    metadata: {},
  };
}

describe('validateGeneratedSessionPlan', () => {
  it('accepts a generated plan inside the selected category with no excessive repetition', () => {
    const result = validateGeneratedSessionPlan({ plan: plan(), coverageEvidence: baseCoverage });

    expect(result.valid).toBe(true);
  });

  it('rejects a generated plan outside the app-selected target category', () => {
    const result = validateGeneratedSessionPlan({
      plan: plan({ category: 'food_dining' }),
      coverageEvidence: baseCoverage,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasonCodes).toContain('category_mismatch');
      expect(result.details.selectedCategory).toBe('greetings_basics');
      expect(result.details.generatedCategory).toBe('food_dining');
    }
  });

  it('rejects more than one repeated non-review key phrase while tolerating a single repeat', () => {
    const tolerated = validateGeneratedSessionPlan({
      plan: plan({
        keyPhrases: [
          phrase({ japanese: 'すみません', romaji: 'sumimasen' }),
          phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' }),
        ],
      }),
      coverageEvidence: baseCoverage,
    });
    const rejected = validateGeneratedSessionPlan({
      plan: plan({
        keyPhrases: [
          phrase({ japanese: 'すみません', romaji: 'sumimasen' }),
          phrase({ japanese: 'ください', romaji: 'kudasai' }),
        ],
      }),
      coverageEvidence: baseCoverage,
    });

    expect(tolerated.valid).toBe(true);
    expect(rejected.valid).toBe(false);
    if (!rejected.valid) {
      expect(rejected.reasonCodes).toContain('repeated_key_phrases');
      expect(rejected.details.repeatedNonReviewKeyPhraseCount).toBe(2);
    }
  });

  it('allows repeated topics and phrases only when they are review candidates', () => {
    const coverageWithReview = {
      ...baseCoverage,
      reviewCandidates: [
        {
          type: 'lesson_topic',
          identity: 'ordering food',
          display: 'Ordering food',
          category: 'food_dining',
          topicIdentity: 'ordering food',
          topic: 'Ordering food',
          strength: 6,
          reasonCodes: ['wrong_exercise_result'],
          evidenceSessionIds: ['session-food'],
          lastSeenAt: '2026-05-20T08:00:00.000Z',
        },
        {
          type: 'key_phrase',
          identity: 'ja:ください',
          display: 'ください (kudasai)',
          category: 'food_dining',
          topicIdentity: 'ordering food',
          topic: 'Ordering food',
          strength: 6,
          reasonCodes: ['wrong_exercise_result'],
          evidenceSessionIds: ['session-food'],
          lastSeenAt: '2026-05-20T08:00:00.000Z',
        },
      ],
    } as CoverageEvidence;

    const repeatedReview = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Ordering food',
        keyPhrases: [
          phrase({ japanese: 'ください', romaji: 'kudasai' }),
          phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' }),
        ],
      }),
      coverageEvidence: coverageWithReview,
    });
    const repeatedNonReviewTopic = validateGeneratedSessionPlan({
      plan: plan({ topic: 'Ordering food' }),
      coverageEvidence: baseCoverage,
    });

    expect(repeatedReview.valid).toBe(true);
    expect(repeatedNonReviewTopic.valid).toBe(false);
    if (!repeatedNonReviewTopic.valid) {
      expect(repeatedNonReviewTopic.reasonCodes).toContain('repeated_lesson_topic');
    }
  });
});

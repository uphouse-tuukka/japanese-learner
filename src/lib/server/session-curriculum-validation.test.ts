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
  learningObjectiveSelection: {
    mode: 'canonical',
    reason: 'selected_uncovered_objective',
    objective: {
      id: 'greetings_basics.greet_by_time',
      category: 'greetings_basics',
      communicativeGoalKey: 'greet_by_time',
      description: 'Choose and use a basic greeting that fits the time of day.',
      generationGuidance: 'Teach an appropriate time-of-day greeting.',
    },
    reviewCandidate: null,
  },
  coveredCategories: [],
  coveredLearningObjectives: [],
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

const stationTransferTask =
  'At a station, apply the selected Learning Objective through a new interaction and transfer challenge.';
const originStationReviewTopic =
  'Station encounter review: Ask where someone is from and state a country or place of origin.';
const greetingStationReviewTopic =
  'Station encounter review: Choose and use a basic greeting that fits the time of day.';

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
    learningObjectiveId?: string | null;
    intentionalReview?: Record<string, unknown> | null;
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
    metadata: {
      ...(overrides.learningObjectiveId === null
        ? {}
        : {
            learningObjectiveId: overrides.learningObjectiveId ?? 'greetings_basics.greet_by_time',
          }),
      ...(overrides.intentionalReview === undefined
        ? {}
        : { intentionalReview: overrides.intentionalReview }),
    },
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

  it('requires the app-selected canonical Learning Objective identity', () => {
    const missing = validateGeneratedSessionPlan({
      plan: plan({ learningObjectiveId: null }),
      coverageEvidence: baseCoverage,
    });
    const unknown = validateGeneratedSessionPlan({
      plan: plan({ learningObjectiveId: 'greetings_basics.model_invented_goal' }),
      coverageEvidence: baseCoverage,
    });
    const wrongCategory = validateGeneratedSessionPlan({
      plan: plan({ learningObjectiveId: 'travel_essentials.recognize_numbers' }),
      coverageEvidence: baseCoverage,
    });

    for (const result of [missing, unknown, wrongCategory]) {
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reasonCodes).toContain('invalid_learning_objective_identity');
        expect(result.details.selectedLearningObjectiveId).toBe('greetings_basics.greet_by_time');
      }
    }
  });

  it('rejects a paraphrased mastered objective even when its Lesson Topic title looks fresh', () => {
    const coverageWithMastery = {
      ...baseCoverage,
      coveredLearningObjectives: [
        {
          id: 'greetings_basics.exchange_origins',
          category: 'greetings_basics',
          count: 1,
          sessionIds: ['origin-mastery'],
          topicIdentities: ['saying where you are from'],
          firstSeenAt: '2026-05-01T08:00:00.000Z',
          lastSeenAt: '2026-05-01T08:00:00.000Z',
          lastMasteredAt: '2026-05-01T08:00:00.000Z',
        },
      ],
    } as CoverageEvidence;

    const result = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Introducing your country of origin',
        learningObjectiveId: 'greetings_basics.exchange_origins',
      }),
      coverageEvidence: coverageWithMastery,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reasonCodes).toContain('repeated_learning_objective');
      expect(result.details.generatedLearningObjectiveId).toBe('greetings_basics.exchange_origins');
    }
  });

  it('requires an eligible intentional review to identify its candidate and fresh transfer task', () => {
    const reviewCandidate = {
      type: 'lesson_topic' as const,
      identity: 'saying where you are from',
      display: 'Saying where you are from',
      category: 'greetings_basics' as const,
      topicIdentity: 'saying where you are from',
      topic: 'Saying where you are from',
      strength: 8,
      reasonCodes: ['structured_review_intent' as const],
      evidenceSessionIds: ['origin-session'],
      lastSeenAt: '2026-05-03T08:00:00.000Z',
      originalTreatmentContextIds: [],
      treatmentEvidenceComplete: true,
    };
    const coverageWithReview = {
      ...baseCoverage,
      learningObjectiveSelection: {
        mode: 'canonical',
        reason: 'selected_review_candidate_objective',
        objective: {
          id: 'greetings_basics.exchange_origins',
          category: 'greetings_basics',
          communicativeGoalKey: 'exchange_origins',
          description: 'Ask where someone is from and state a country or place of origin.',
          generationGuidance: 'Teach a two-way origin exchange.',
        },
        reviewCandidate,
      },
      coveredLearningObjectives: [
        {
          id: 'greetings_basics.exchange_origins',
          category: 'greetings_basics',
          count: 1,
          sessionIds: ['origin-session'],
          topicIdentities: ['saying where you are from'],
          firstSeenAt: '2026-05-01T08:00:00.000Z',
          lastSeenAt: '2026-05-01T08:00:00.000Z',
          lastMasteredAt: null,
        },
      ],
      reviewCandidates: [reviewCandidate],
    } as CoverageEvidence;

    const missingClaim = validateGeneratedSessionPlan({
      plan: plan({ learningObjectiveId: 'greetings_basics.exchange_origins' }),
      coverageEvidence: coverageWithReview,
    });
    const explicitReview = validateGeneratedSessionPlan({
      plan: plan({
        topic: originStationReviewTopic,
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: stationTransferTask,
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const duplicatedTreatment = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Station review of origins',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'At a station, saying where you are from',
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const duplicatedLessonTopic = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Saying where you are from',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: stationTransferTask,
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const cosmeticRestatement = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Practice where you are from once more',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: stationTransferTask,
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const ungroundedContextClaim = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Talking about homeland',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'Practice asking where they come from.',
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const negatedContextClaim = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Talking about homeland',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'At a station, do not use the station context; discuss homeland instead.',
        },
      }),
      coverageEvidence: coverageWithReview,
    });
    const staleCandidate = validateGeneratedSessionPlan({
      plan: plan({
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'saying where you are from',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'Exchange hometowns with a fellow traveler while waiting for a train.',
        },
      }),
      coverageEvidence: { ...coverageWithReview, reviewCandidates: [] },
    });
    const unrelatedCandidate = {
      ...reviewCandidate,
      identity: 'exchanging names',
      display: 'Exchanging names',
      topicIdentity: 'exchanging names',
      topic: 'Exchanging names',
      evidenceSessionIds: ['name-session'],
    };
    const unrelatedReview = validateGeneratedSessionPlan({
      plan: plan({
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: 'exchanging names',
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'Exchange hometowns with a fellow traveler while waiting for a train.',
        },
      }),
      coverageEvidence: {
        ...coverageWithReview,
        learningObjectiveSelection: {
          ...coverageWithReview.learningObjectiveSelection,
          reviewCandidate: unrelatedCandidate,
        },
        reviewCandidates: [unrelatedCandidate],
      },
    });
    const exhaustedContextCandidate = {
      ...reviewCandidate,
      identity: 'station train platform hotel lobby reception shop store counter street sidewalk',
      display: 'Station hotel shop and street origin exchange',
      topicIdentity: 'station hotel shop street origin exchange',
      topic: 'Station hotel shop and street origin exchange',
    };
    const exhaustedContextReview = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Station origin exchange',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        intentionalReview: {
          candidateType: 'lesson_topic',
          candidateIdentity: exhaustedContextCandidate.identity,
          learningObjectiveId: 'greetings_basics.exchange_origins',
          transferContextId: 'station_encounter',
          transferTask: 'Exchange origins at a station.',
        },
      }),
      coverageEvidence: {
        ...coverageWithReview,
        learningObjectiveSelection: {
          ...coverageWithReview.learningObjectiveSelection,
          reviewCandidate: exhaustedContextCandidate,
        },
        reviewCandidates: [exhaustedContextCandidate],
      },
    });

    expect(missingClaim.valid).toBe(false);
    if (!missingClaim.valid) {
      expect(missingClaim.reasonCodes).toContain('ineligible_review');
      expect(missingClaim.details.intentionalReviewStatus).toBe('missing');
    }
    expect(explicitReview.valid).toBe(true);
    expect(explicitReview.details.intentionalReviewStatus).toBe('eligible');
    expect(duplicatedTreatment.valid).toBe(false);
    if (!duplicatedTreatment.valid) {
      expect(duplicatedTreatment.reasonCodes).toContain('ineligible_review');
      expect(duplicatedTreatment.details.intentionalReviewStatus).toBe('context_not_grounded');
    }
    expect(duplicatedLessonTopic.valid).toBe(false);
    if (!duplicatedLessonTopic.valid) {
      expect(duplicatedLessonTopic.reasonCodes).toContain('ineligible_review');
      expect(duplicatedLessonTopic.details.intentionalReviewStatus).toBe('context_not_grounded');
    }
    expect(cosmeticRestatement.valid).toBe(false);
    if (!cosmeticRestatement.valid) {
      expect(cosmeticRestatement.reasonCodes).toContain('ineligible_review');
      expect(cosmeticRestatement.details.intentionalReviewStatus).toBe('context_not_grounded');
    }
    expect(ungroundedContextClaim.valid).toBe(false);
    if (!ungroundedContextClaim.valid) {
      expect(ungroundedContextClaim.reasonCodes).toContain('ineligible_review');
      expect(ungroundedContextClaim.details.intentionalReviewStatus).toBe('context_not_grounded');
    }
    expect(negatedContextClaim.valid).toBe(false);
    if (!negatedContextClaim.valid) {
      expect(negatedContextClaim.reasonCodes).toContain('ineligible_review');
      expect(negatedContextClaim.details.intentionalReviewStatus).toBe('context_not_grounded');
    }
    expect(staleCandidate.valid).toBe(false);
    if (!staleCandidate.valid) {
      expect(staleCandidate.reasonCodes).toContain('ineligible_review');
      expect(staleCandidate.details.intentionalReviewStatus).toBe('stale_or_resolved');
    }
    expect(unrelatedReview.valid).toBe(false);
    if (!unrelatedReview.valid) {
      expect(unrelatedReview.reasonCodes).toContain('ineligible_review');
      expect(unrelatedReview.details.intentionalReviewStatus).toBe('unrelated');
    }
    expect(exhaustedContextReview.valid).toBe(false);
    if (!exhaustedContextReview.valid) {
      expect(exhaustedContextReview.reasonCodes).toContain('ineligible_review');
      expect(exhaustedContextReview.details.intentionalReviewStatus).toBe('context_mismatch');
    }
  });

  it('keeps exact-topic validation for unmigrated categories without requiring an objective id', () => {
    const compatibilityCoverage = {
      ...baseCoverage,
      categoryRotation: {
        ...baseCoverage.categoryRotation,
        currentCategory: 'emergencies_health',
        selectedCategory: 'emergencies_health',
        allowedCategories: ['emergencies_health'],
        preferredCategories: ['emergencies_health'],
        blockedCategories: [],
      },
      learningObjectiveSelection: {
        mode: 'legacy_exact_topic',
        reason: 'category_not_migrated_compatibility',
        objective: null,
        reviewCandidate: null,
      },
      coveredTopics: [
        {
          identity: 'finding a pharmacy',
          topic: 'Finding a pharmacy',
          category: 'emergencies_health',
          count: 1,
          sessionIds: ['session-health'],
          firstSeenAt: '2026-05-20T08:00:00.000Z',
          lastSeenAt: '2026-05-20T08:00:00.000Z',
        },
      ],
    } as CoverageEvidence;

    const fresh = validateGeneratedSessionPlan({
      plan: plan({
        category: 'emergencies_health',
        topic: 'Asking for cold medicine',
        learningObjectiveId: null,
      }),
      coverageEvidence: compatibilityCoverage,
    });
    const repeated = validateGeneratedSessionPlan({
      plan: plan({
        category: 'emergencies_health',
        topic: 'Finding a pharmacy',
        learningObjectiveId: null,
      }),
      coverageEvidence: compatibilityCoverage,
    });
    const inventedObjective = validateGeneratedSessionPlan({
      plan: plan({
        category: 'emergencies_health',
        topic: 'Asking for cold medicine',
        learningObjectiveId: 'emergencies_health.model_invented_goal',
      }),
      coverageEvidence: compatibilityCoverage,
    });

    expect(fresh.valid).toBe(true);
    expect(repeated.valid).toBe(false);
    if (!repeated.valid) {
      expect(repeated.reasonCodes).toContain('repeated_lesson_topic');
    }
    expect(inventedObjective.valid).toBe(false);
    if (!inventedObjective.valid) {
      expect(inventedObjective.reasonCodes).toContain('invalid_learning_objective_identity');
    }
  });

  it('rejects every repeated non-review key phrase in the authoritative lesson list', () => {
    const singleRepeat = validateGeneratedSessionPlan({
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

    expect(singleRepeat.valid).toBe(false);
    if (!singleRepeat.valid) {
      expect(singleRepeat.reasonCodes).toContain('repeated_key_phrases');
      expect(singleRepeat.details.repeatedNonReviewKeyPhraseCount).toBe(1);
    }
    expect(rejected.valid).toBe(false);
    if (!rejected.valid) {
      expect(rejected.reasonCodes).toContain('repeated_key_phrases');
      expect(rejected.details.repeatedNonReviewKeyPhraseCount).toBe(2);
    }
  });

  it('allows covered utility language as supporting context outside the key phrase list', () => {
    const supportingPlan = plan({
      keyPhrases: [phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' })],
    });
    supportingPlan.lesson.explanation =
      'You may still say すみません (sumimasen) naturally before the newly taught phrase.';

    const result = validateGeneratedSessionPlan({
      plan: supportingPlan,
      coverageEvidence: baseCoverage,
    });

    expect(result.valid).toBe(true);
  });

  it('allows only the explicitly selected eligible review phrase to repeat', () => {
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

    const repeatedUnselectedCandidate = validateGeneratedSessionPlan({
      plan: plan({
        topic: 'Ordering food',
        keyPhrases: [
          phrase({ japanese: 'ください', romaji: 'kudasai' }),
          phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' }),
        ],
      }),
      coverageEvidence: coverageWithReview,
    });
    const selectedPhraseCandidate = {
      type: 'key_phrase' as const,
      identity: 'ja:すみません',
      display: 'すみません (sumimasen)',
      category: 'greetings_basics' as const,
      topicIdentity: 'basic greetings',
      topic: 'Basic greetings',
      strength: 7,
      reasonCodes: ['wrong_exercise_result' as const],
      evidenceSessionIds: ['session-greetings'],
      lastSeenAt: '2026-05-22T08:00:00.000Z',
      originalTreatmentContextIds: [],
      treatmentEvidenceComplete: true,
    };
    const coverageWithSelectedPhraseReview = {
      ...baseCoverage,
      learningObjectiveSelection: {
        ...baseCoverage.learningObjectiveSelection,
        reason: 'selected_review_candidate_objective',
        reviewCandidate: selectedPhraseCandidate,
      },
      coveredLearningObjectives: [
        {
          id: 'greetings_basics.greet_by_time',
          category: 'greetings_basics',
          count: 1,
          sessionIds: ['session-greetings'],
          topicIdentities: ['basic greetings'],
          firstSeenAt: '2026-05-21T08:00:00.000Z',
          lastSeenAt: '2026-05-21T08:00:00.000Z',
          lastMasteredAt: null,
        },
      ],
      reviewCandidates: [selectedPhraseCandidate],
    } as CoverageEvidence;
    const explicitPhraseReview = validateGeneratedSessionPlan({
      plan: plan({
        topic: greetingStationReviewTopic,
        keyPhrases: [
          phrase({ japanese: 'すみません', romaji: 'sumimasen' }),
          phrase({ japanese: 'こんにちは', romaji: 'konnichiwa' }),
        ],
        intentionalReview: {
          candidateType: 'key_phrase',
          candidateIdentity: 'ja:すみません',
          learningObjectiveId: 'greetings_basics.greet_by_time',
          transferContextId: 'station_encounter',
          transferTask: stationTransferTask,
        },
      }),
      coverageEvidence: coverageWithSelectedPhraseReview,
    });

    expect(repeatedUnselectedCandidate.valid).toBe(false);
    if (!repeatedUnselectedCandidate.valid) {
      expect(repeatedUnselectedCandidate.reasonCodes).toEqual(
        expect.arrayContaining(['repeated_lesson_topic', 'repeated_key_phrases']),
      );
    }
    expect(explicitPhraseReview.valid).toBe(true);
  });
});

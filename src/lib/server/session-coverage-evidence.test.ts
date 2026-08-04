import { describe, expect, it } from 'vitest';
import {
  buildCoverageEvidence,
  getPhraseIdentityKeys,
  normalizeTopicIdentity,
  parseCoverageSourceSessions,
  phrasesShareIdentity,
  type CoverageSourceSession,
} from '$lib/server/session-coverage-evidence';
import type { Exercise, Session, SessionMeta } from '$lib/types';

function meta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    summaryText: 'Completed a lesson.',
    category: 'greetings_basics',
    topic: 'Basic greetings',
    accuracy: 80,
    strengths: [],
    weaknesses: [],
    exerciseTypes: ['multiple_choice'],
    keyPhrases: ['こんにちは'],
    ...overrides,
  };
}

function sourceSession(
  id: string,
  category: string | undefined,
  topic: string,
  completedAt: string,
  overrides: Partial<SessionMeta> = {},
): CoverageSourceSession {
  return {
    sessionId: id,
    createdAt: completedAt,
    completedAt,
    meta: meta({ category, topic, ...overrides }),
  };
}

function storedSession(
  id: string,
  summary: string | null,
  overrides: Partial<Session> = {},
): Session {
  return {
    id,
    userId: 'user-1',
    mode: 'ai',
    status: 'completed',
    model: 'gpt-5.4',
    tokenInput: 1,
    tokenOutput: 1,
    summary,
    createdAt: `2026-05-${id.padStart(2, '0')}T08:00:00.000Z`,
    completedAt: `2026-05-${id.padStart(2, '0')}T08:05:00.000Z`,
    ...overrides,
    plannedCoverage: overrides.plannedCoverage ?? null,
  };
}

const exercise: Exercise = {
  id: 'exercise-1',
  type: 'multiple_choice',
  title: 'Excuse me',
  japanese: 'すみません',
  romaji: 'sumimasen',
  englishContext: 'Excuse me',
  tags: ['greetings'],
  difficulty: 1,
  question: 'What does すみません (sumimasen) mean?',
  choices: ['Excuse me', 'Goodbye'],
  correctAnswer: 'Excuse me',
};

describe('coverage source parsing', () => {
  it('uses every parseable completed AI session instead of a recent ten-session cap', () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      storedSession(String(index + 1), JSON.stringify(meta({ topic: `Topic ${index + 1}` }))),
    );

    const parsed = parseCoverageSourceSessions([
      ...sessions,
      storedSession('practice', JSON.stringify(meta({ topic: 'Practice' })), { mode: 'practice' }),
      storedSession('planned', JSON.stringify(meta({ topic: 'Planned' })), { status: 'planned' }),
      storedSession('bad', 'not-json'),
    ]);

    expect(parsed.totalCompletedAiSessions).toBe(13);
    expect(parsed.ignoredCompletedAiSessions).toBe(1);
    expect(parsed.sessions).toHaveLength(12);

    const evidence = buildCoverageEvidence({
      sessions: parsed.sessions,
      totalCompletedAiSessionCount: parsed.totalCompletedAiSessions,
      ignoredCompletedAiSessionCount: parsed.ignoredCompletedAiSessions,
    });

    expect(evidence.source).toEqual({
      totalCompletedAiSessions: 13,
      parseableCompletedAiSessions: 12,
      ignoredCompletedAiSessions: 1,
    });
    expect(evidence.coveredTopics.map((topic) => topic.topic)).toContain('Topic 12');
  });
});

describe('coverage identity normalization', () => {
  it('normalizes direct phrase and topic variants without semantic matching', () => {
    expect(getPhraseIdentityKeys('  Sumimasen!  ')).toEqual(['romaji:sumimasen']);
    expect(getPhraseIdentityKeys('すみません (sumimasen)')).toEqual([
      'ja:すみません',
      'romaji:sumimasen',
    ]);
    expect(
      phrasesShareIdentity(
        {
          japanese: 'すみません',
          romaji: 'sumimasen',
          english: 'Excuse me',
          usage: 'Polite opener',
        },
        'Sumimasen!',
      ),
    ).toBe(true);
    expect(
      phrasesShareIdentity({ japanese: 'すみません', romaji: 'sumimasen' }, '失礼します'),
    ).toBe(false);
    expect(normalizeTopicIdentity(' Restaurant_ordering! ')).toBe('restaurant ordering');
    expect(normalizeTopicIdentity('Ordering at a restaurant')).not.toBe('restaurant ordering');
  });

  it('prefers structured key phrase details but falls back to legacy key phrase strings', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('new', 'food_dining', 'Ordering food', '2026-05-03T08:00:00.000Z', {
          keyPhrases: ['legacy should not win'],
          keyPhraseDetails: [
            {
              japanese: 'お願いします',
              romaji: 'onegaishimasu',
              english: 'Please',
              usage: 'Polite request',
            },
          ],
        }),
        sourceSession('old', 'transport', 'Train platforms', '2026-05-02T08:00:00.000Z', {
          keyPhrases: ['何番線ですか (nan-bansen desu ka)'],
        }),
      ],
    });

    expect(evidence.coveredKeyPhrases.map((phrase) => phrase.display)).toContain(
      'お願いします (onegaishimasu)',
    );
    expect(evidence.coveredKeyPhrases.map((phrase) => phrase.display)).not.toContain(
      'legacy should not win',
    );
    expect(
      evidence.coveredKeyPhrases.some((phrase) =>
        phrase.identities.includes('romaji:nan bansen desu ka'),
      ),
    ).toBe(true);
  });
});

describe('deterministic category selection', () => {
  it('starts first-time learners at the first beginner-flow category', () => {
    const evidence = buildCoverageEvidence({ sessions: [] });

    expect(evidence.categoryRotation.selectedCategory).toBe('greetings_basics');
    expect(evidence.categoryRotation.selectionReason).toBe('no_prior_category_beginner_flow');
    expect(evidence.learningObjectiveSelection).toMatchObject({
      mode: 'canonical',
      reason: 'selected_uncovered_objective',
      objective: { id: 'greetings_basics.greet_by_time' },
    });
  });

  it('continues at streak 1, rotates at streak 2, and blocks current category at streak 3', () => {
    const streakOne = buildCoverageEvidence({
      sessions: [sourceSession('1', 'food_dining', 'Ordering food', '2026-05-03T08:00:00.000Z')],
    });
    expect(streakOne.categoryRotation.selectedCategory).toBe('food_dining');
    expect(streakOne.categoryRotation.selectionReason).toBe('continued_current_category_depth');

    const streakTwo = buildCoverageEvidence({
      sessions: [
        sourceSession('2', 'food_dining', 'Restaurant requests', '2026-05-04T08:00:00.000Z'),
        sourceSession('1', 'food_dining', 'Ordering food', '2026-05-03T08:00:00.000Z'),
        sourceSession('0', 'transport', 'Train platforms', '2026-05-02T08:00:00.000Z'),
      ],
    });
    expect(streakTwo.categoryRotation.selectionReason).toBe('rotated_after_two_session_streak');
    expect(streakTwo.categoryRotation.selectedCategory).not.toBe('food_dining');
    expect(streakTwo.categoryRotation.selectedCategory).toBe('greetings_basics');

    const streakThree = buildCoverageEvidence({
      sessions: [
        sourceSession('3', 'food_dining', 'Paying the bill', '2026-05-05T08:00:00.000Z'),
        sourceSession('2', 'food_dining', 'Restaurant requests', '2026-05-04T08:00:00.000Z'),
        sourceSession('1', 'food_dining', 'Ordering food', '2026-05-03T08:00:00.000Z'),
      ],
    });
    expect(streakThree.categoryRotation.mustRotate).toBe(true);
    expect(streakThree.categoryRotation.blockedCategories).toEqual(['food_dining']);
    expect(streakThree.categoryRotation.selectedCategory).not.toBe('food_dining');
  });

  it('selects Travel Essentials after greetings depth before scenario categories', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('2', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z'),
        sourceSession('1', 'greetings_basics', 'Basic greetings', '2026-05-03T08:00:00.000Z'),
      ],
    });

    expect(evidence.categoryRotation.selectionReason).toBe('rotated_after_two_session_streak');
    expect(evidence.categoryRotation.selectedCategory).toBe('travel_essentials');
    expect(evidence.categoryRotation.preferredCategories.slice(0, 3)).toEqual([
      'travel_essentials',
      'food_dining',
      'transport',
    ]);
  });

  it('treats a newest missing category as a streak break instead of skipping it', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('3', undefined, 'Uncategorized recap', '2026-05-05T08:00:00.000Z'),
        sourceSession('2', 'food_dining', 'Restaurant requests', '2026-05-04T08:00:00.000Z'),
        sourceSession('1', 'food_dining', 'Ordering food', '2026-05-03T08:00:00.000Z'),
      ],
    });

    expect(evidence.categoryRotation.currentCategory).toBeNull();
    expect(evidence.categoryRotation.currentCategoryStreak).toBe(0);
    expect(evidence.categoryRotation.mustRotate).toBe(false);
    expect(evidence.categoryRotation.blockedCategories).toEqual([]);
  });

  it('allows a third same-category session only for strong item-level review evidence', () => {
    const sessions = [
      sourceSession('2', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z', {
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      }),
      sourceSession('1', 'greetings_basics', 'Basic greetings', '2026-05-03T08:00:00.000Z'),
    ];

    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: [
        {
          sessionId: '2',
          exerciseId: 'exercise-1',
          isCorrect: false,
          answerText: 'sorry',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise,
        },
      ],
    });

    expect(evidence.categoryRotation.selectedCategory).toBe('greetings_basics');
    expect(evidence.categoryRotation.selectionReason).toBe(
      'continued_current_category_for_review_candidate',
    );
    expect(evidence.reviewCandidates[0]).toMatchObject({
      type: 'key_phrase',
      display: 'すみません (sumimasen)',
      reasonCodes: ['wrong_exercise_result'],
    });
  });
});

describe('deterministic Learning Objective selection', () => {
  it('selects the next uncovered objective for Category Depth', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'greetings_basics', 'Morning hellos', '2026-05-03T08:00:00.000Z', {
          learningObjectiveId: 'greetings_basics.greet_by_time',
        }),
      ],
    });

    expect(evidence.categoryRotation.selectedCategory).toBe('greetings_basics');
    expect(evidence.coveredLearningObjectives).toEqual([
      expect.objectContaining({
        id: 'greetings_basics.greet_by_time',
        topicIdentities: ['morning hellos'],
      }),
    ]);
    expect(evidence.learningObjectiveSelection).toMatchObject({
      mode: 'canonical',
      reason: 'selected_uncovered_objective',
      objective: { id: 'greetings_basics.exchange_names' },
    });
  });

  it('treats paraphrased Lesson Topics as one covered canonical objective', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession(
          '2',
          'greetings_basics',
          'Introducing your country of origin',
          '2026-05-04T08:00:00.000Z',
          { learningObjectiveId: 'greetings_basics.exchange_origins' },
        ),
        sourceSession(
          '1',
          'greetings_basics',
          'Saying where you are from',
          '2026-05-03T08:00:00.000Z',
          { learningObjectiveId: 'greetings_basics.exchange_origins' },
        ),
      ],
    });

    expect(evidence.coveredLearningObjectives).toEqual([
      expect.objectContaining({
        id: 'greetings_basics.exchange_origins',
        count: 2,
        topicIdentities: ['introducing your country of origin', 'saying where you are from'],
      }),
    ]);
    expect(evidence.learningObjectiveSelection.objective?.id).not.toBe(
      'greetings_basics.exchange_origins',
    );
  });

  it('selects a covered objective only when current Review Evidence maps to it', () => {
    const objectiveIds = [
      'greetings_basics.greet_by_time',
      'greetings_basics.exchange_names',
      'greetings_basics.exchange_origins',
      'greetings_basics.ask_and_answer_wellbeing',
      'greetings_basics.use_polite_thanks_and_apologies',
      'greetings_basics.open_and_close_brief_interactions',
    ];
    const sessions = objectiveIds.map((learningObjectiveId, index) =>
      sourceSession(
        `objective-${index}`,
        'greetings_basics',
        index === 2 ? 'Saying where you are from' : `Greeting objective ${index}`,
        `2026-05-${String(index + 2).padStart(2, '0')}T08:00:00.000Z`,
        {
          learningObjectiveId,
          accuracy: index === 2 ? 50 : 100,
          keyPhraseDetails:
            index === 2 ? [{ japanese: 'どちらからですか', romaji: 'dochira kara desu ka' }] : [],
        },
      ),
    );
    sessions.unshift(
      sourceSession('other', 'food_dining', 'Ordering tea', '2026-05-08T08:00:00.000Z'),
      sourceSession(
        'origin-review',
        'greetings_basics',
        'Saying where you are from',
        '2026-05-09T08:00:00.000Z',
        {
          learningObjectiveId: 'greetings_basics.exchange_origins',
          accuracy: 0,
          keyPhraseDetails: [{ japanese: 'どちらからですか', romaji: 'dochira kara desu ka' }],
        },
      ),
    );

    const originExercise = {
      ...exercise,
      id: 'origin-exercise',
      japanese: 'どちらからですか',
      romaji: 'dochira kara desu ka',
    };
    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: [
        {
          sessionId: 'origin-review',
          exerciseId: 'origin-exercise-1',
          isCorrect: false,
          answerText: 'incorrect',
          createdAt: '2026-05-09T08:10:00.000Z',
          exercise: originExercise,
        },
        {
          sessionId: 'origin-review',
          exerciseId: 'origin-exercise-2',
          isCorrect: false,
          answerText: 'incorrect again',
          createdAt: '2026-05-09T08:11:00.000Z',
          exercise: { ...originExercise, id: 'origin-exercise-2' },
        },
      ],
    });

    expect(evidence.learningObjectiveSelection).toMatchObject({
      mode: 'canonical',
      reason: 'selected_review_candidate_objective',
      objective: { id: 'greetings_basics.exchange_origins' },
      reviewCandidate: expect.objectContaining({
        topicIdentity: 'saying where you are from',
      }),
    });
  });

  it('keeps legacy exact-topic coverage without inventing a canonical mapping', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'emergencies_health', 'Finding a pharmacy', '2026-05-03T08:00:00.000Z'),
      ],
    });

    expect(evidence.categoryRotation.selectedCategory).toBe('emergencies_health');
    expect(evidence.coveredTopics).toEqual([
      expect.objectContaining({
        topic: 'Finding a pharmacy',
        category: 'emergencies_health',
      }),
    ]);
    expect(evidence.coveredLearningObjectives).toEqual([]);
    expect(evidence.learningObjectiveSelection).toMatchObject({
      mode: 'canonical',
      reason: 'selected_uncovered_objective',
      objective: { id: 'emergencies_health.describe_symptoms_and_severity' },
      reviewCandidate: null,
    });
  });

  it('rotates to the next viable category when the selected catalog is saturated', () => {
    const objectiveIds = [
      'greetings_basics.greet_by_time',
      'greetings_basics.exchange_names',
      'greetings_basics.exchange_origins',
      'greetings_basics.ask_and_answer_wellbeing',
      'greetings_basics.use_polite_thanks_and_apologies',
      'greetings_basics.open_and_close_brief_interactions',
    ];
    const olderGreetingSessions = objectiveIds
      .slice(1)
      .map((learningObjectiveId, index) =>
        sourceSession(
          `older-${index}`,
          'greetings_basics',
          `Covered greeting objective ${index}`,
          `2026-05-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
          { learningObjectiveId, accuracy: 100 },
        ),
      );

    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession(
          'latest',
          'greetings_basics',
          'Morning greetings',
          '2026-05-08T08:00:00.000Z',
          { learningObjectiveId: 'greetings_basics.greet_by_time', accuracy: 100 },
        ),
        sourceSession('separator', 'food_dining', 'Ordering tea', '2026-05-07T08:00:00.000Z'),
        ...olderGreetingSessions,
      ],
    });

    expect(evidence.categoryRotation).toMatchObject({
      selectedCategory: 'travel_essentials',
      selectionReason: 'rotated_to_available_learning_objective',
    });
    expect(evidence.learningObjectiveSelection).toMatchObject({
      reason: 'selected_uncovered_objective',
      objective: { id: 'travel_essentials.recognize_numbers' },
    });
  });
});

describe('review candidate derivation', () => {
  it('keeps journal, summary weakness, and handoff mentions advisory', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
          handoffNotes: ['Review sumimasen in a new situation.'],
          weaknesses: ['Polite openers still need practice.'],
        }),
      ],
    });

    expect(evidence.reviewCandidates).toEqual([]);
  });

  it('resolves older phrase weakness evidence after a later correct item result', () => {
    const sessions = [
      sourceSession('mastery', 'greetings_basics', 'Polite openers', '2026-05-05T08:00:00.000Z', {
        accuracy: 100,
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      }),
      sourceSession('weakness', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z', {
        accuracy: 0,
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      }),
    ];

    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: [
        {
          sessionId: 'weakness',
          exerciseId: 'weakness-result',
          isCorrect: false,
          answerText: 'sorry',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise,
        },
        {
          sessionId: 'mastery',
          exerciseId: 'mastery-result',
          isCorrect: true,
          answerText: 'Excuse me',
          createdAt: '2026-05-05T08:10:00.000Z',
          exercise,
        },
      ],
    });

    expect(evidence.reviewCandidates).toEqual([]);
  });

  it('resolves older topic Review Evidence after canonical mastery under a new title', () => {
    const sessions = [
      sourceSession(
        'mastery',
        'greetings_basics',
        'Introducing your country of origin',
        '2026-05-05T08:00:00.000Z',
        {
          learningObjectiveId: 'greetings_basics.exchange_origins',
          accuracy: 100,
          keyPhraseDetails: [
            { japanese: 'アメリカから来ました', romaji: 'amerika kara kimashita' },
          ],
        },
      ),
      sourceSession(
        'weakness',
        'greetings_basics',
        'Saying where you are from',
        '2026-05-04T08:00:00.000Z',
        {
          learningObjectiveId: 'greetings_basics.exchange_origins',
          accuracy: 0,
          keyPhraseDetails: [
            { japanese: 'アメリカから来ました', romaji: 'amerika kara kimashita' },
          ],
        },
      ),
    ];
    const unrelatedExercise = {
      ...exercise,
      japanese: 'どこですか',
      romaji: 'doko desu ka',
    };

    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: [
        {
          sessionId: 'weakness',
          exerciseId: 'weakness-result-1',
          isCorrect: false,
          answerText: 'incorrect',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise: unrelatedExercise,
        },
        {
          sessionId: 'weakness',
          exerciseId: 'weakness-result-2',
          isCorrect: false,
          answerText: 'incorrect again',
          createdAt: '2026-05-04T08:11:00.000Z',
          exercise: { ...unrelatedExercise, id: 'weakness-result-2' },
        },
      ],
    });

    expect(evidence.coveredLearningObjectives).toEqual([
      expect.objectContaining({
        id: 'greetings_basics.exchange_origins',
        lastMasteredAt: '2026-05-05T08:00:00.000Z',
      }),
    ]);
    expect(evidence.reviewCandidates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'lesson_topic',
          identity: 'saying where you are from',
        }),
      ]),
    );
  });

  it('resolves an earlier same-session phrase miss after a later correct result', () => {
    const session = sourceSession(
      'same-session',
      'greetings_basics',
      'Polite openers',
      '2026-05-04T08:00:00.000Z',
      {
        accuracy: 50,
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      },
    );

    const evidence = buildCoverageEvidence({
      sessions: [session],
      exerciseResults: [
        {
          sessionId: session.sessionId,
          exerciseId: 'later-correct',
          orderIndex: 1,
          isCorrect: true,
          answerText: 'Excuse me',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise: { ...exercise, id: 'later-correct' },
        },
        {
          sessionId: session.sessionId,
          exerciseId: 'earlier-miss',
          orderIndex: 0,
          isCorrect: false,
          answerText: 'sorry',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise: { ...exercise, id: 'earlier-miss' },
        },
      ],
    });

    expect(evidence.reviewCandidates).toEqual([]);
  });

  it('reopens phrase review for new specific weakness evidence after mastery', () => {
    const sessions = [
      sourceSession(
        'new-weakness',
        'greetings_basics',
        'Polite openers',
        '2026-05-06T08:00:00.000Z',
        {
          accuracy: 0,
          keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
        },
      ),
      sourceSession('mastery', 'greetings_basics', 'Polite openers', '2026-05-05T08:00:00.000Z', {
        accuracy: 100,
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      }),
      sourceSession(
        'old-weakness',
        'greetings_basics',
        'Polite openers',
        '2026-05-04T08:00:00.000Z',
        {
          accuracy: 0,
          keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
        },
      ),
    ];
    const result = (sessionId: string, isCorrect: boolean, day: string) => ({
      sessionId,
      exerciseId: `${sessionId}-result`,
      isCorrect,
      answerText: isCorrect ? 'Excuse me' : 'sorry',
      createdAt: `2026-05-${day}T08:10:00.000Z`,
      exercise,
    });

    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: [
        result('old-weakness', false, '04'),
        result('mastery', true, '05'),
        result('new-weakness', false, '06'),
      ],
    });

    expect(evidence.reviewCandidates).toEqual([
      expect.objectContaining({
        type: 'key_phrase',
        reasonCodes: ['wrong_exercise_result'],
        evidenceSessionIds: ['new-weakness'],
      }),
    ]);
  });

  it('uses explicit structured review intent while ignoring neutral handoff text', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
          handoffNotes: ['Sumimasen was a positive strength.'],
          reviewIntents: [
            {
              type: 'key_phrase',
              identity: 'ja:すみません',
              display: 'すみません (sumimasen)',
              reason: 'The learner could not produce the phrase in a specific item.',
              reviewRequested: true,
            },
          ],
        }),
      ],
    });

    expect(evidence.reviewCandidates).toEqual([
      expect.objectContaining({
        type: 'key_phrase',
        identity: 'ja:すみません',
        reasonCodes: ['structured_review_intent'],
        evidenceSessionIds: ['1'],
      }),
    ]);
  });

  it('does not make a whole topic reviewable from one unrelated wrong exercise', () => {
    const session = sourceSession('1', 'food_dining', 'Ordering food', '2026-05-04T08:00:00.000Z', {
      accuracy: 90,
      keyPhraseDetails: [],
    });

    const evidence = buildCoverageEvidence({
      sessions: [session],
      exerciseResults: [
        {
          sessionId: session.sessionId,
          exerciseId: 'unrelated-miss',
          isCorrect: false,
          answerText: 'incorrect',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise: { ...exercise, id: 'unrelated-miss', japanese: '', romaji: '' },
        },
      ],
    });

    expect(
      evidence.reviewCandidates.find((candidate) => candidate.type === 'lesson_topic'),
    ).toBeUndefined();
  });

  it('requires multiple unresolved item signals before making a topic reviewable', () => {
    const sessions = [
      sourceSession('second', 'food_dining', 'Ordering food', '2026-05-05T08:00:00.000Z', {
        accuracy: 80,
        keyPhraseDetails: [],
      }),
      sourceSession('first', 'food_dining', 'Ordering food', '2026-05-04T08:00:00.000Z', {
        accuracy: 80,
        keyPhraseDetails: [],
      }),
    ];
    const exerciseResults = sessions.map((session) => ({
      sessionId: session.sessionId,
      exerciseId: `${session.sessionId}-miss`,
      isCorrect: false,
      answerText: 'incorrect',
      createdAt: session.completedAt ?? session.createdAt,
      exercise: { ...exercise, id: `${session.sessionId}-miss`, japanese: '', romaji: '' },
    }));

    const oneSignal = buildCoverageEvidence({
      sessions: [sessions[1]],
      exerciseResults: [exerciseResults[1]],
    });
    const twoSignals = buildCoverageEvidence({ sessions, exerciseResults });

    expect(oneSignal.reviewCandidates).toEqual([]);
    expect(twoSignals.reviewCandidates).toEqual([
      expect.objectContaining({
        type: 'lesson_topic',
        identity: 'ordering food',
        evidenceSessionIds: ['first', 'second'],
      }),
    ]);
  });

  it('resolves topic weakness only after a later fully correct session for that topic', () => {
    const oldWeakness = sourceSession(
      'old-weakness',
      'food_dining',
      'Ordering food',
      '2026-05-04T08:00:00.000Z',
      { accuracy: 50, keyPhraseDetails: [] },
    );
    const partial = sourceSession(
      'partial',
      'food_dining',
      'Ordering food',
      '2026-05-05T08:00:00.000Z',
      { accuracy: 90, keyPhraseDetails: [] },
    );
    const mastery = sourceSession(
      'mastery',
      'food_dining',
      'Ordering food',
      '2026-05-06T08:00:00.000Z',
      { accuracy: 100, keyPhraseDetails: [] },
    );
    const wrongResult = (sessionId: string, exerciseId: string, day: string) => ({
      sessionId,
      exerciseId,
      isCorrect: false,
      answerText: 'incorrect',
      createdAt: `2026-05-${day}T08:10:00.000Z`,
      exercise: { ...exercise, id: exerciseId, japanese: '', romaji: '' },
    });
    const oldResults = [
      wrongResult('old-weakness', 'miss-1', '04'),
      wrongResult('old-weakness', 'miss-2', '04'),
    ];

    const unresolved = buildCoverageEvidence({
      sessions: [partial, oldWeakness],
      exerciseResults: [...oldResults, wrongResult('partial', 'unrelated-miss', '05')],
    });
    const resolved = buildCoverageEvidence({
      sessions: [mastery, partial, oldWeakness],
      exerciseResults: [...oldResults, wrongResult('partial', 'unrelated-miss', '05')],
    });

    expect(unresolved.reviewCandidates).toEqual([
      expect.objectContaining({
        type: 'lesson_topic',
        identity: 'ordering food',
        evidenceSessionIds: ['old-weakness', 'partial'],
      }),
    ]);
    expect(resolved.reviewCandidates).toEqual([]);
  });

  it('does not make every phrase in a low-accuracy session reviewable without item evidence', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'food_dining', 'Ordering food', '2026-05-04T08:00:00.000Z', {
          accuracy: 30,
          keyPhraseDetails: [
            { japanese: '水をください', romaji: 'mizu o kudasai', english: 'Water, please' },
          ],
        }),
      ],
    });

    expect(evidence.reviewCandidates).toEqual([]);
  });

  it('keeps genuine unresolved mixed phrase evidence reviewable', () => {
    const session = sourceSession(
      'mixed',
      'greetings_basics',
      'Polite openers',
      '2026-05-04T08:00:00.000Z',
      {
        accuracy: 50,
        keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
      },
    );

    const evidence = buildCoverageEvidence({
      sessions: [session],
      exerciseResults: [
        {
          sessionId: session.sessionId,
          exerciseId: 'correct-use',
          isCorrect: true,
          answerText: 'Excuse me',
          createdAt: '2026-05-04T08:09:00.000Z',
          exercise: { ...exercise, id: 'correct-use' },
        },
        {
          sessionId: session.sessionId,
          exerciseId: 'wrong-use',
          isCorrect: false,
          answerText: 'sorry',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise: { ...exercise, id: 'wrong-use' },
        },
      ],
    });

    expect(evidence.reviewCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'key_phrase',
          identity: 'ja:すみません',
          reasonCodes: ['mixed_exercise_result'],
        }),
      ]),
    );
  });

  it('does not create mention candidates from substring-only matches', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'social_conversation', 'bar', '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ romaji: 'go', english: 'five' }],
          weaknesses: ['The ongoing review mentioned embargo forms, not the target items.'],
          handoffNotes: ['Keep ongoing grammar separate from the previous embargo discussion.'],
        }),
      ],
    });

    expect(evidence.reviewCandidates).toEqual([]);
  });

  it('caps the prompt-facing avoid and review lists deterministically', () => {
    const sessions = Array.from({ length: 35 }, (_, index) =>
      sourceSession(
        `s-${index}`,
        'shopping',
        `Shopping topic ${index}`,
        `2026-05-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
        {
          keyPhraseDetails: [
            {
              romaji: `hyougen ${index}`,
              english: `Phrase ${index}`,
            },
          ],
          handoffNotes: [`Review hyougen ${index}.`],
        },
      ),
    );

    const evidence = buildCoverageEvidence({
      sessions,
      exerciseResults: sessions.map((session, index) => ({
        sessionId: session.sessionId,
        exerciseId: `exercise-${index}`,
        isCorrect: false,
        answerText: 'incorrect',
        createdAt: session.completedAt ?? session.createdAt,
        exercise: {
          ...exercise,
          id: `exercise-${index}`,
          japanese: '',
          romaji: `hyougen ${index}`,
        },
      })),
    });

    expect(evidence.coveredTopics).toHaveLength(35);
    expect(evidence.coveredKeyPhrases).toHaveLength(35);
    expect(evidence.reviewCandidates.length).toBeGreaterThan(5);
    expect(evidence.promptSnapshot.avoidTopics).toHaveLength(20);
    expect(evidence.promptSnapshot.avoidKeyPhrases).toHaveLength(30);
    expect(evidence.promptSnapshot.reviewCandidates).toHaveLength(5);
  });

  it('truncates prompt-facing evidence fields defensively', () => {
    const longTopic = `Ordering food ${'with very long context '.repeat(20)}`;
    const longPhrase = `sumimasen ${'with extra spelling detail '.repeat(20)}`;

    const longSession = sourceSession('1', 'food_dining', longTopic, '2026-05-04T08:00:00.000Z', {
      keyPhraseDetails: [{ romaji: longPhrase, english: 'Excuse me' }],
    });
    const evidence = buildCoverageEvidence({
      sessions: [longSession],
      exerciseResults: [
        {
          sessionId: longSession.sessionId,
          exerciseId: 'long-phrase-result',
          isCorrect: false,
          answerText: 'incorrect',
          createdAt: longSession.completedAt ?? longSession.createdAt,
          exercise: { ...exercise, id: 'long-phrase-result', japanese: '', romaji: longPhrase },
        },
      ],
    });

    const promptTopic = evidence.promptSnapshot.avoidTopics[0];
    const promptPhrase = evidence.promptSnapshot.avoidKeyPhrases[0];
    const promptReview = evidence.promptSnapshot.reviewCandidates[0];

    expect(promptTopic.topic.length).toBeLessThanOrEqual(160);
    expect(promptTopic.identity.length).toBeLessThanOrEqual(160);
    expect(promptPhrase.display.length).toBeLessThanOrEqual(160);
    expect(promptPhrase.primaryIdentity.length).toBeLessThanOrEqual(160);
    expect(promptPhrase.identities.every((identity) => identity.length <= 160)).toBe(true);
    expect(promptReview.display.length).toBeLessThanOrEqual(160);
    expect(promptReview.identity.length).toBeLessThanOrEqual(160);
  });
});

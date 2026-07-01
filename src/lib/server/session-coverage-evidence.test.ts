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

describe('review candidate derivation', () => {
  it('uses wrong/mixed exercise evidence plus exact handoff and journal mentions', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'greetings_basics', 'Polite openers', '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ japanese: 'すみません', romaji: 'sumimasen', english: 'Excuse me' }],
          handoffNotes: ['Review sumimasen in a new situation.'],
        }),
        sourceSession('2', 'transport', 'Train platforms', '2026-05-03T08:00:00.000Z', {
          weaknesses: ['Train platforms still need practice.'],
          keyPhrases: ['何番線ですか'],
        }),
      ],
      exerciseResults: [
        {
          sessionId: '1',
          exerciseId: 'exercise-1',
          isCorrect: false,
          answerText: 'sorry',
          createdAt: '2026-05-04T08:10:00.000Z',
          exercise,
        },
      ],
      learningJournal: 'Persistent weak spot: Train platforms under pressure.',
    });

    const phraseCandidate = evidence.reviewCandidates.find(
      (candidate) =>
        candidate.type === 'key_phrase' && candidate.display === 'すみません (sumimasen)',
    );
    expect(phraseCandidate?.reasonCodes).toEqual(['handoff_note_mention', 'wrong_exercise_result']);

    const topicCandidate = evidence.reviewCandidates.find(
      (candidate) => candidate.type === 'lesson_topic' && candidate.identity === 'train platforms',
    );
    expect(topicCandidate?.reasonCodes).toEqual(['learning_journal_mention', 'weakness_mention']);
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

  it('does not create mention candidates from substring-only matches', () => {
    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'social_conversation', 'bar', '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ romaji: 'go', english: 'five' }],
          weaknesses: ['The ongoing review mentioned embargo forms, not the target items.'],
          handoffNotes: ['Keep ongoing grammar separate from the previous embargo discussion.'],
        }),
      ],
      learningJournal: 'Ongoing confidence issue: embargo examples were confusing.',
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

    const evidence = buildCoverageEvidence({ sessions });

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

    const evidence = buildCoverageEvidence({
      sessions: [
        sourceSession('1', 'food_dining', longTopic, '2026-05-04T08:00:00.000Z', {
          keyPhraseDetails: [{ romaji: longPhrase, english: 'Excuse me' }],
          handoffNotes: [`Review ${longPhrase} again.`],
        }),
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

import { describe, expect, it } from 'vitest';

import {
  TOPIC_CATEGORIES,
  buildPublicChallengePrompt,
  buildSessionPlanPrompt,
  type TopicCategoryKey,
} from '$lib/server/ai-session-prompts';

function systemPrompt(prompt: { messages: Array<{ role: string; content: string }> }): string {
  return prompt.messages.find((message) => message.role === 'system')?.content ?? '';
}

function userPayload<T>(prompt: { messages: Array<{ role: string; content: string }> }): T {
  const content = prompt.messages.find((message) => message.role === 'user')?.content;
  if (!content) {
    throw new Error('Missing user prompt message');
  }
  return JSON.parse(content) as T;
}

function baseSessionInput() {
  return {
    userId: 'user-1',
    userName: 'Test Learner',
    userLevel: 'beginner' as const,
  };
}

describe('ai session prompt builders', () => {
  it('exports topic category metadata with stable keys', () => {
    const compatibleKey: TopicCategoryKey = 'food_dining';

    expect(compatibleKey).toBe('food_dining');
    expect(TOPIC_CATEGORIES.map((category) => category.key)).toEqual([
      'greetings_basics',
      'travel_essentials',
      'food_dining',
      'transport',
      'shopping',
      'directions',
      'hotel_accommodation',
      'emergencies_health',
      'social_conversation',
      'sightseeing_culture',
      'bars_nightlife',
    ]);
    expect(TOPIC_CATEGORIES[1]).toMatchObject({
      key: 'travel_essentials',
      label: 'Travel Essentials',
    });
    expect(
      TOPIC_CATEGORIES.find((category) => category.key === 'greetings_basics')?.examples,
    ).not.toMatch(/\bcounting\b/i);
    expect(
      TOPIC_CATEGORIES.find((category) => category.key === 'travel_essentials')?.examples,
    ).toContain('Portable travel literacy');
  });

  it('buildSessionPlanPrompt clamps targetExerciseCount to 4..12 and slices sessionHistory to 10', () => {
    const sessionHistory = Array.from({ length: 12 }, (_, index) => ({
      date: `2026-05-${String(index + 1).padStart(2, '0')}`,
      category: 'food_dining',
      topic: `Topic ${index}`,
      accuracy: 70,
      strengths: [],
      weaknesses: [],
      handoffNotes: [],
      keyPhrases: [],
    }));

    const lowPrompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      exerciseCount: 3.2,
      sessionHistory,
    });
    const lowPayload = userPayload<{
      targetExerciseCount: number;
      user: { sessionHistory: Array<{ topic: string }> };
    }>(lowPrompt);

    expect(lowPrompt.targetExerciseCount).toBe(4);
    expect(lowPayload.targetExerciseCount).toBe(4);
    expect(lowPrompt.sessionHistory).toHaveLength(10);
    expect(lowPayload.user.sessionHistory).toHaveLength(10);
    expect(lowPayload.user.sessionHistory.map((session) => session.topic)).toEqual(
      sessionHistory.slice(0, 10).map((session) => session.topic),
    );

    const highPrompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      exerciseCount: 12.8,
      sessionHistory,
    });
    const highPayload = userPayload<{ targetExerciseCount: number }>(highPrompt);

    expect(highPrompt.targetExerciseCount).toBe(12);
    expect(highPayload.targetExerciseCount).toBe(12);
  });

  it('buildSessionPlanPrompt includes rotation, handoff, and recent cultural-note context without repeating stale notes', () => {
    const prompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      exerciseCount: 6,
      categoryRotation: {
        currentCategory: 'food_dining',
        currentCategoryStreak: 3,
        recentCategories: [
          { category: 'food_dining', sessionsAgo: 1 },
          { category: 'transport', sessionsAgo: 2 },
        ],
        neverVisited: ['shopping', 'directions'],
      },
      sessionHistory: [
        {
          date: '2026-05-01',
          category: 'food_dining',
          topic: 'Restaurant requests',
          accuracy: 60,
          strengths: ['polite openers'],
          weaknesses: ['counter words'],
          handoffNotes: ['Practice asking for recommendations.'],
          nextSteps: ['This legacy next step should be ignored.'],
          culturalNote: '  Avoid sticking chopsticks\n upright in rice.  ',
          keyPhrases: [],
        },
        {
          date: '2026-05-02',
          category: 'transport',
          topic: 'Train platforms',
          accuracy: 70,
          strengths: [],
          weaknesses: [],
          nextSteps: ['Legacy fallback when handoff is absent.'],
          culturalNote: 'Stand aside before boarding trains.',
          keyPhrases: [],
        },
        {
          date: '2026-05-03',
          category: 'shopping',
          topic: 'Convenience store checkout',
          accuracy: 80,
          strengths: [],
          weaknesses: [],
          culturalNote: 'Put cash in the tray at checkout.',
          keyPhrases: [],
        },
        {
          date: '2026-05-04',
          category: 'directions',
          topic: 'Asking the way',
          accuracy: 85,
          strengths: [],
          weaknesses: [],
          culturalNote: 'Station exits are often numbered.',
          keyPhrases: [],
        },
        {
          date: '2026-05-05',
          category: 'sightseeing_culture',
          topic: 'Temple etiquette',
          accuracy: 90,
          strengths: [],
          weaknesses: [],
          culturalNote: 'This fifth cultural note should not be included.',
          keyPhrases: [],
        },
      ],
    });

    const promptText = systemPrompt(prompt);

    expect(promptText).toContain('TOPIC CATEGORY ROTATION:');
    expect(promptText).toContain(
      'For early sessions, prefer starting with greetings_basics, then travel_essentials, then food_dining, transport, and shopping',
    );
    expect(promptText).toContain(
      'For travel_essentials, teach portable travel literacy rather than scenario leftovers',
    );
    expect(promptText).toContain('Current category streak: "food_dining" × 3 session(s)');
    expect(promptText).toContain('MUST switch to a different category — 3 sessions reached.');
    expect(promptText).toContain(
      'Recently visited (do NOT return to these yet): food_dining, transport.',
    );
    expect(promptText).toContain('Never visited yet (good candidates): shopping, directions.');
    expect(promptText).toContain('PRIOR SESSION HANDOFF (internal; soft guidance only):');
    expect(promptText).toContain(
      '[Restaurant requests] weak: counter words; handoff: Practice asking for recommendations.',
    );
    expect(promptText).not.toContain('This legacy next step should be ignored.');
    expect(promptText).toContain(
      '[Train platforms] handoff: Legacy fallback when handoff is absent.',
    );
    expect(promptText).toContain('RECENT CULTURAL NOTES (avoid repeating these unless essential):');
    expect(promptText).toContain(
      '- [food_dining / Restaurant requests] "Avoid sticking chopsticks upright in rice."',
    );
    expect(promptText).toContain(
      '- [transport / Train platforms] "Stand aside before boarding trains."',
    );
    expect(promptText).toContain(
      '- [shopping / Convenience store checkout] "Put cash in the tray at checkout."',
    );
    expect(promptText).toContain(
      '- [directions / Asking the way] "Station exits are often numbered."',
    );
    expect(promptText).not.toContain('This fifth cultural note should not be included.');
  });

  it('buildSessionPlanPrompt treats Coverage Evidence as authoritative rails and the Learning Journal as advisory memory', () => {
    const prompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      coverageEvidence: {
        source: {
          totalCompletedAiSessions: 3,
          parseableCompletedAiSessions: 2,
          ignoredCompletedAiSessions: 1,
        },
        categoryRotation: {
          currentCategory: 'food_dining',
          currentCategoryStreak: 3,
          selectedCategory: 'emergencies_health',
          selectionReason: 'mandatory_rotation_after_three_session_streak',
          mustRotate: true,
          allowedCategories: ['emergencies_health', 'social_conversation'],
          preferredCategories: ['emergencies_health', 'social_conversation'],
          blockedCategories: ['food_dining'],
        },
        learningObjectiveSelection: {
          mode: 'legacy_exact_topic',
          reason: 'category_not_migrated_compatibility',
          objective: null,
          reviewCandidate: null,
        },
        categoryCoverage: [
          {
            category: 'food_dining',
            count: 3,
            lastSeenAt: '2026-05-03T08:00:00.000Z',
          },
        ],
        avoidTopics: [
          {
            identity: 'ordering food',
            topic: 'Ordering food',
            category: 'food_dining',
            count: 2,
            lastSeenAt: '2026-05-03T08:00:00.000Z',
          },
        ],
        avoidKeyPhrases: [
          {
            primaryIdentity: 'ja:すみません',
            identities: ['ja:すみません', 'romaji:sumimasen'],
            display: 'すみません (sumimasen)',
            category: 'food_dining',
            topic: 'Ordering food',
            count: 2,
            lastSeenAt: '2026-05-03T08:00:00.000Z',
          },
        ],
        reviewCandidates: [
          {
            type: 'key_phrase',
            identity: 'ja:ください',
            display: 'ください (kudasai)',
            category: 'food_dining',
            topic: 'Ordering food',
            topicIdentity: 'ordering food',
            strength: 7,
            reasonCodes: ['wrong_exercise_result'],
            evidenceSessionIds: ['session-2'],
            lastSeenAt: '2026-05-03T08:00:00.000Z',
          },
        ],
      },
      learningJournal:
        'The learner understands greetings, but still hesitates when using ください (kudasai) in requests.',
      curriculumValidationFeedback: [
        'Previous generation violated curriculum rails: category_mismatch.',
        'Lesson category must be exactly "emergencies_health".',
      ],
    });

    const promptText = systemPrompt(prompt);
    const payload = userPayload<{
      user: {
        coverageEvidence: {
          categoryRotation: { selectedCategory: string; blockedCategories: string[] };
          avoidKeyPhrases: Array<{ display: string }>;
          reviewCandidates: Array<{ display: string }>;
        };
        learningJournal: string;
        curriculumValidationFeedback: string[];
      };
    }>(prompt);

    expect(promptText).toContain('COVERAGE EVIDENCE — AUTHORITATIVE APP-SIDE RAILS:');
    expect(promptText).toContain('travel_essentials: Travel Essentials');
    expect(promptText).toContain(
      'For early sessions, prefer starting with greetings_basics, then travel_essentials, then food_dining, transport, and shopping',
    );
    expect(promptText).toContain('Target Topic Category: "emergencies_health"');
    expect(promptText).toContain('Lesson category MUST be exactly "emergencies_health".');
    expect(promptText).toContain('Blocked Topic Categories: food_dining.');
    expect(promptText).toContain(
      'Avoid covered Lesson Key Phrases unless listed as Review Candidates:',
    );
    expect(promptText).toContain('すみません (sumimasen) [Ordering food]');
    expect(promptText).toContain('Review Candidates: key_phrase ください (kudasai)');
    expect(promptText).toContain('LEARNING JOURNAL — ADVISORY TUTOR MEMORY:');
    expect(promptText).toContain(
      'not exact proof of covered categories, lesson topics, or phrases',
    );
    expect(promptText).toContain('must never create or authorize a Review Candidate');
    expect(promptText).toContain('handoff notes cannot authorize repetition');
    expect(promptText).toContain('CURRICULUM VALIDATION FEEDBACK FROM PREVIOUS ATTEMPT:');
    expect(promptText).toContain(
      'Previous generation violated curriculum rails: category_mismatch.',
    );
    expect(promptText).toContain(
      'Revise the next attempt to satisfy these app-side rails exactly.',
    );
    expect(payload.user.coverageEvidence.categoryRotation.selectedCategory).toBe(
      'emergencies_health',
    );
    expect(payload.user.coverageEvidence.categoryRotation.blockedCategories).toEqual([
      'food_dining',
    ]);
    expect(payload.user.coverageEvidence.avoidKeyPhrases[0].display).toBe('すみません (sumimasen)');
    expect(payload.user.coverageEvidence.reviewCandidates[0].display).toBe('ください (kudasai)');
    expect(payload.user.learningJournal).toBe(
      'The learner understands greetings, but still hesitates when using ください (kudasai) in requests.',
    );
    expect(payload.user.curriculumValidationFeedback).toEqual([
      'Previous generation violated curriculum rails: category_mismatch.',
      'Lesson category must be exactly "emergencies_health".',
    ]);
  });

  it('passes the app-selected Learning Objective as a hard generation rail', () => {
    const prompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      coverageEvidence: {
        source: {
          totalCompletedAiSessions: 1,
          parseableCompletedAiSessions: 1,
          ignoredCompletedAiSessions: 0,
        },
        categoryRotation: {
          currentCategory: 'greetings_basics',
          currentCategoryStreak: 1,
          selectedCategory: 'greetings_basics',
          selectionReason: 'continued_current_category_depth',
          mustRotate: false,
          allowedCategories: ['greetings_basics', 'travel_essentials'],
          preferredCategories: ['greetings_basics', 'travel_essentials'],
          blockedCategories: [],
        },
        learningObjectiveSelection: {
          mode: 'canonical',
          reason: 'selected_uncovered_objective',
          objective: {
            id: 'greetings_basics.exchange_origins',
            category: 'greetings_basics',
            communicativeGoalKey: 'exchange_origins',
            description: 'Ask where someone is from and state a country or place of origin.',
            generationGuidance:
              'Teach a two-way origin exchange without expanding into a full introduction.',
          },
          reviewCandidate: null,
        },
        categoryCoverage: [],
        avoidTopics: [],
        avoidKeyPhrases: [],
        reviewCandidates: [],
      },
    });

    const promptText = systemPrompt(prompt);
    const payload = userPayload<{
      selectedLearningObjective: { id: string; category: string };
      requiredOutputContract: {
        learningObjectiveId: { const: string };
        lesson: {
          category: { const: string };
          topic: { rule: string };
          keyPhrases: { rule: string };
        };
      };
    }>(prompt);

    expect(promptText).toContain(
      'Learning Objective identity MUST be exactly "greetings_basics.exchange_origins"',
    );
    expect(promptText).toContain(
      'Ask where someone is from and state a country or place of origin.',
    );
    expect(promptText).toContain(
      'Teach a two-way origin exchange without expanding into a full introduction.',
    );
    expect(payload.selectedLearningObjective).toEqual(
      expect.objectContaining({
        id: 'greetings_basics.exchange_origins',
        category: 'greetings_basics',
      }),
    );
    expect(payload.requiredOutputContract.learningObjectiveId.const).toBe(
      'greetings_basics.exchange_origins',
    );
    expect(payload.requiredOutputContract.lesson).toMatchObject({
      category: { const: 'greetings_basics' },
      topic: {
        rule: expect.stringContaining(
          'Ask where someone is from and state a country or place of origin.',
        ),
      },
      keyPhrases: {
        rule: expect.stringContaining('greetings_basics.exchange_origins'),
      },
    });
    const contractText = JSON.stringify(payload.requiredOutputContract);
    expect(contractText).not.toContain('restaurant');
    expect(contractText).not.toContain('すみません');
    expect(contractText).not.toContain('Choose the greeting');
  });

  it('requires a generated review plan to claim the selected candidate and a fresh transfer task', () => {
    const reviewCandidate = {
      type: 'key_phrase' as const,
      identity: 'ja:どちらからですか',
      display: 'どちらからですか (dochira kara desu ka)',
      category: 'greetings_basics' as const,
      topicIdentity: 'exchanging origins',
      topic: 'Exchanging origins',
      strength: 7,
      reasonCodes: ['wrong_exercise_result' as const],
      evidenceSessionIds: ['session-origin'],
      lastSeenAt: '2026-05-03T08:00:00.000Z',
    };
    const prompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      coverageEvidence: {
        source: {
          totalCompletedAiSessions: 1,
          parseableCompletedAiSessions: 1,
          ignoredCompletedAiSessions: 0,
        },
        categoryRotation: {
          currentCategory: 'greetings_basics',
          currentCategoryStreak: 1,
          selectedCategory: 'greetings_basics',
          selectionReason: 'continued_current_category_for_review_candidate',
          mustRotate: false,
          allowedCategories: ['greetings_basics'],
          preferredCategories: ['greetings_basics'],
          blockedCategories: [],
        },
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
        categoryCoverage: [],
        avoidTopics: [],
        avoidKeyPhrases: [],
        reviewCandidates: [reviewCandidate],
      },
    });

    const promptText = systemPrompt(prompt);
    const payload = userPayload<{
      requiredOutputContract: {
        intentionalReview: {
          candidateType: { const: string };
          candidateIdentity: { const: string };
          learningObjectiveId: { const: string };
          transferContextId: { const: string };
          transferTask: { const: string; rule: string };
        };
        lesson: {
          topic: { const: string; rule: string };
        };
      };
    }>(prompt);

    expect(promptText).toContain(
      'Output valid JSON only with top-level keys: learningObjectiveId, intentionalReview, lesson, exercises, focus.',
    );
    expect(promptText).toContain('INTENTIONAL REVIEW REQUIRED');
    expect(promptText).toContain('ja:どちらからですか');
    expect(promptText).toContain(
      'Use the app-owned Lesson Topic and transfer task as the concrete setting for the explanation and exercises.',
    );
    expect(promptText).toContain(
      'Previously covered utility language may appear as supporting context without being declared in lesson.keyPhrases.',
    );
    expect(payload.requiredOutputContract.intentionalReview).toMatchObject({
      candidateType: { const: 'key_phrase' },
      candidateIdentity: { const: 'ja:どちらからですか' },
      learningObjectiveId: { const: 'greetings_basics.exchange_origins' },
      transferContextId: { const: 'station_encounter' },
      transferTask: {
        const:
          'At a station, apply the selected Learning Objective through a new interaction and transfer challenge.',
        rule: 'Copy this app-owned affirmative transfer task exactly.',
      },
    });
    expect(payload.requiredOutputContract.lesson.topic).toEqual({
      const:
        'Station encounter review: Ask where someone is from and state a country or place of origin.',
      rule: 'Copy this app-owned context-grounded Lesson Topic exactly.',
    });
  });

  it('allows private elementary prompts to include speaking with microphone-specific rules', () => {
    const prompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      userLevel: 'elementary',
      japaneseWritingEnabled: false,
    });
    const promptText = systemPrompt(prompt);

    expect(promptText).toContain(
      'Allowed exercise types: multiple_choice, translation, listening, fill_blank, speaking.',
    );
    expect(promptText).toContain('- speaking:');
    expect(promptText).toContain(
      'sentence and sentenceRomaji must contain the visible placeholder "____"',
    );
    expect(promptText).toContain(
      'sentenceEnglish must be a complete English meaning or context with no blank placeholder',
    );
    expect(promptText).toContain(
      'Never include both Japanese/romaji and English in the same choice string',
    );
    expect(promptText).toContain(
      'If choices are English-only meanings, the question itself must include the Japanese phrase with romaji',
    );
    expect(promptText).toContain(
      'For "What is [English] in Japanese?" or "Translate [English] into Japanese" questions, choices must be Japanese with romaji only',
    );
    expect(promptText).toContain('responseKind');
    expect(promptText).toContain('expectedRomaji');
    expect(promptText).toContain(
      'acceptedAnswers must include common particle/formality variants when they preserve the same intent',
    );
    expect(promptText).toContain(
      'rubric must tell the checker to accept semantically equivalent learner speech, not exact wording',
    );
    expect(promptText).toContain(
      'rubric must still reject wrong objects, wrong actions, negation errors, or unrelated phrases',
    );
    expect(promptText).toContain(
      'Elementary speaking exercises must use responseKind="situational_response" only.',
    );
    expect(promptText).toContain('Translation direction must be ja_to_en only.');
    expect(promptText).toContain('- translation: direction ("ja_to_en" only),');
    expect(promptText).toContain(
      'For elementary, translation direction must always be "ja_to_en".',
    );
    expect(promptText).not.toContain('- translation: direction ("ja_to_en" or "en_to_ja")');
    expect(promptText).not.toContain('Translation can be ja_to_en or en_to_ja.');
    expect(promptText).toContain(
      'Japanese writing input is disabled. Do not require typed Japanese script answers; microphone speaking exercises may still ask the learner to speak Japanese.',
    );
    expect(promptText).not.toContain(
      'All expected learner input must be in romaji or English only.',
    );
  });

  it('keeps absolute beginner and beginner private prompts out of speaking exercises', () => {
    const absoluteBeginnerPrompt = buildSessionPlanPrompt({
      ...baseSessionInput(),
      userLevel: 'absolute_beginner',
    });
    const beginnerPrompt = buildSessionPlanPrompt(baseSessionInput());

    expect(systemPrompt(absoluteBeginnerPrompt)).toContain('Speaking exercises are not allowed.');
    expect(systemPrompt(absoluteBeginnerPrompt)).not.toContain('- speaking:');
    expect(systemPrompt(beginnerPrompt)).toContain('Speaking exercises are not allowed.');
    expect(systemPrompt(beginnerPrompt)).not.toContain('- speaking:');
  });

  it('keeps public challenge requirements on the explicit public type boundary', () => {
    const prompt = buildPublicChallengePrompt({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 4,
    });
    const promptText = systemPrompt(prompt);

    expect(promptText).toContain(
      'Public challenge must not include speaking exercises or require microphone access.',
    );
    expect(promptText).not.toContain('- speaking:');
    expect(promptText).not.toContain('fill_blank:');
    expect(promptText).not.toContain('reorder:');
    expect(promptText).not.toContain('reading:');
    expect(promptText).toContain('- multiple_choice:');
    expect(promptText).toContain('- translation:');
    expect(promptText).toContain('- listening:');
  });

  it('buildPublicChallengePrompt preserves the public multiple_choice contract and target count behavior', () => {
    const prompt = buildPublicChallengePrompt({
      scenario: 'food_dining',
      scenarioLabel: 'Ordering at a restaurant',
      targetExerciseCount: 0.4,
    });
    const promptText = systemPrompt(prompt);
    const payload = userPayload<{
      scenario: string;
      scenarioLabel: string;
      targetExerciseCount: number;
      requiredOutputExample: { lesson: { category: string }; focus: string };
    }>(prompt);

    expect(prompt.targetExerciseCount).toBe(1);
    expect(payload.targetExerciseCount).toBe(0.4);
    expect(payload.scenario).toBe('food_dining');
    expect(payload.scenarioLabel).toBe('Ordering at a restaurant');
    expect(payload.requiredOutputExample.lesson.category).toBe('food_dining');
    expect(payload.requiredOutputExample.focus).toBe('food_dining');
    expect(promptText).toContain(
      "Create a lesson about: Ordering at a restaurant. The lesson category MUST be 'food_dining'.",
    );
    expect(promptText).toContain(
      'PUBLIC CHALLENGE MULTIPLE_CHOICE RULE: Only two patterns are allowed. Pattern 1: question is an English scenario asking what to say; all choices must be Japanese and include romaji in parentheses. Pattern 2: question includes a Japanese phrase and asks what it means; all choices must be English only.',
    );
    expect(promptText).toContain(
      '- For public challenge multiple_choice exercises, ONLY use one of these two patterns: (a) scenario question in English + Japanese choices with romaji; (b) Japanese phrase in the question asking for meaning + English-only choices.',
    );
    expect(promptText).toContain(
      '- For public challenge multiple_choice exercises, NEVER use English scenario question + English-only choices.',
    );
  });
});

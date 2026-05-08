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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MissionTurn } from '$lib/types';

const { mockResponsesCreate } = vi.hoisted(() => ({
  mockResponsesCreate: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = {
      create: mockResponsesCreate,
    };
  },
}));

vi.mock('$lib/server/config', () => ({
  config: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

vi.mock('$lib/server/db', () => ({
  recordTokenUsage: vi.fn(),
}));

import { generateMissionTurn } from '$lib/server/missions-ai';

const mission = {
  id: 'mission-1',
  title: 'Restaurant ordering',
  category: 'food_dining',
  difficulty: 'easy',
  sequence: 1,
  scenarioPrompt: 'You are ordering food at a casual restaurant in Tokyo.',
  badgeEmoji: '🍜',
  badgeName: 'Ramen Rookie',
  badgeStatement: 'You can order politely at a restaurant.',
  unlockSessionsRequired: 0,
  startUnlocked: true,
} as const;

describe('generateMissionTurn', () => {
  beforeEach(() => {
    mockResponsesCreate.mockReset();
    mockResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        npcDialogue: {
          japanese: 'ご注文はお決まりですか。',
          romaji: 'gochuumon wa okimari desu ka.',
        },
        sceneDescription: 'A server arrives at your table.',
        characterName: '店員',
        characterEmoji: '🍽️',
        choices: [
          {
            japanese: 'はい、ラーメンをお願いします。',
            romaji: 'hai, raamen o onegaishimasu.',
            english: 'Yes, ramen please.',
            isCorrect: true,
          },
          {
            japanese: 'はい、お願いします。',
            romaji: 'hai, onegaishimasu.',
            english: 'Yes, please.',
            isCorrect: false,
          },
          {
            japanese: 'お水をください。',
            romaji: 'omizu o kudasai.',
            english: 'Water, please.',
            isCorrect: false,
          },
        ],
      }),
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30,
      },
    });
  });

  it('tells the model not to reuse earlier learner responses and to vary the correct answer position', async () => {
    await generateMissionTurn({
      mission,
      mode: 'practice',
      turnNumber: 2,
      totalTurns: 5,
      conversationHistory: [
        {
          turnNumber: 1,
          npcDialogue: {
            japanese: 'いらっしゃいませ。',
            romaji: 'irasshaimase.',
          },
          userResponse: {
            japanese: 'はい、お願いします。',
          },
          feedback: {
            correct: true,
            message: 'Good!',
          },
        },
      ] as MissionTurn[],
    });

    const request = mockResponsesCreate.mock.calls[0]?.[0] as {
      input: Array<{ role: string; content: string }>;
    };
    const systemPrompt = request.input.find((message) => message.role === 'system')?.content ?? '';

    expect(systemPrompt).toContain('Do not reuse any earlier learner response as a choice.');
    expect(systemPrompt).toContain('Do not always place the correct answer first.');
  });

  it('shuffles practice choices so the correct answer is not locked to index 0', async () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValue(0);

    const result = await generateMissionTurn({
      mission,
      mode: 'practice',
      turnNumber: 2,
      totalTurns: 5,
      conversationHistory: [],
    });

    const correctIndex = result.turn.choices?.findIndex((choice) => choice.isCorrect) ?? -1;
    expect(correctIndex).not.toBe(0);
  });
});

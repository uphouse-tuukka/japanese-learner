import { describe, expect, it } from 'vitest';
import {
  buildPlannedSessionCoverage,
  parsePlannedSessionCoverage,
} from './planned-session-coverage';

describe('planned Learning Session coverage metadata', () => {
  it('builds bounded server-owned metadata from a generated lesson', () => {
    expect(
      buildPlannedSessionCoverage({
        lesson: {
          topic: '  Ordering ramen  ',
          category: 'food_dining',
          explanation: 'Practice ordering politely.',
          culturalNote: '  Ticket machines are common.  ',
          keyPhrases: [
            {
              japanese: '  ラーメンをください  ',
              romaji: ' raamen o kudasai ',
              english: ' Ramen, please. ',
              usage: ' Use while ordering. ',
            },
          ],
        },
        learningObjectiveId: ' food_dining.order_item ',
      }),
    ).toEqual({
      version: 1,
      category: 'food_dining',
      learningObjectiveId: 'food_dining.order_item',
      lessonTopic: 'Ordering ramen',
      culturalNote: 'Ticket machines are common.',
      keyPhraseDetails: [
        {
          japanese: 'ラーメンをください',
          romaji: 'raamen o kudasai',
          english: 'Ramen, please.',
          usage: 'Use while ordering.',
        },
      ],
    });
  });

  it('parses valid persisted metadata and rejects corrupted or incomplete records', () => {
    const valid = JSON.stringify({
      version: 1,
      category: 'food_dining',
      lessonTopic: 'Ordering ramen',
      culturalNote: 'Ticket machines are common.',
      keyPhraseDetails: [{ japanese: 'ラーメンをください', romaji: 'raamen o kudasai' }],
    });

    expect(parsePlannedSessionCoverage(valid)).toMatchObject({
      version: 1,
      category: 'food_dining',
      lessonTopic: 'Ordering ramen',
    });
    expect(parsePlannedSessionCoverage('{not-json')).toBeNull();
    expect(parsePlannedSessionCoverage(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parsePlannedSessionCoverage(null)).toBeNull();
  });
});

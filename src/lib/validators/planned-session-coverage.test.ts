import { describe, expect, it } from 'vitest';
import {
  buildPlannedSessionCoverage,
  parsePlannedSessionCoverage,
} from './planned-session-coverage';

const completeKeyPhrases = [
  {
    japanese: '  ラーメンをください  ',
    romaji: ' raamen o kudasai ',
    english: ' Ramen, please. ',
    usage: ' Use while ordering. ',
  },
  {
    japanese: 'おすすめは何ですか',
    romaji: 'osusume wa nan desu ka',
    english: 'What do you recommend?',
    usage: 'Use to ask for a recommendation.',
  },
  {
    japanese: 'お会計をお願いします',
    romaji: 'okaikei o onegaishimasu',
    english: 'The bill, please.',
    usage: 'Use when ready to pay.',
  },
];

describe('planned Learning Session coverage metadata', () => {
  it('builds bounded server-owned metadata from a generated lesson', () => {
    expect(
      buildPlannedSessionCoverage({
        lesson: {
          topic: '  Ordering ramen  ',
          category: 'food_dining',
          explanation: 'Practice ordering politely.',
          culturalNote: '  Ticket machines are common.  ',
          keyPhrases: completeKeyPhrases,
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
        completeKeyPhrases[1],
        completeKeyPhrases[2],
      ],
    });
  });

  it('parses valid persisted metadata and rejects corrupted or incomplete records', () => {
    const validRecord = {
      version: 1,
      category: 'food_dining',
      lessonTopic: 'Ordering ramen',
      culturalNote: 'Ticket machines are common.',
      keyPhraseDetails: completeKeyPhrases,
    };

    expect(parsePlannedSessionCoverage(JSON.stringify(validRecord))).toMatchObject({
      version: 1,
      category: 'food_dining',
      lessonTopic: 'Ordering ramen',
    });
    expect(parsePlannedSessionCoverage('{not-json')).toBeNull();
    expect(parsePlannedSessionCoverage(JSON.stringify({ version: 1 }))).toBeNull();
    expect(
      parsePlannedSessionCoverage(JSON.stringify({ ...validRecord, category: 'not_a_category' })),
    ).toBeNull();
    expect(
      parsePlannedSessionCoverage(JSON.stringify({ ...validRecord, culturalNote: '   ' })),
    ).toBeNull();
    expect(
      parsePlannedSessionCoverage(
        JSON.stringify({ ...validRecord, keyPhraseDetails: completeKeyPhrases.slice(0, 2) }),
      ),
    ).toBeNull();
    expect(parsePlannedSessionCoverage(null)).toBeNull();
  });
});

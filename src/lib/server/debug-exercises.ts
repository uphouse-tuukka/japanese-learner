import { randomUUID } from 'node:crypto';
import type { Exercise, ExerciseType } from '$lib/types';

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
type ExerciseTemplate = WithoutId<Exercise>;

const DEBUG_EXERCISE_TEMPLATES: Record<ExerciseType, ExerciseTemplate[]> = {
  multiple_choice: [
    {
      type: 'multiple_choice',
      title: 'Ordering coffee politely',
      japanese: 'コーヒーを一つお願いします。',
      romaji: 'Koohii o hitotsu onegaishimasu.',
      englishContext: 'You are ordering one coffee at a cafe.',
      tags: ['daily_life', 'cafe', 'polite'],
      difficulty: 1,
      question: 'What does this sentence politely ask for?',
      choices: ['A table for one', 'One coffee', 'The bill', 'A glass of water'],
      correctAnswer: 'One coffee',
      explanation: '一つ means one item, and お願いします is a polite request.',
    },
    {
      type: 'multiple_choice',
      title: 'Asking for the station',
      japanese: '駅はどこですか。',
      romaji: 'Eki wa doko desu ka.',
      englishContext: 'You are asking for directions in town.',
      tags: ['travel', 'directions', 'question'],
      difficulty: 1,
      question: 'What is the speaker asking?',
      choices: [
        'Where is the station?',
        'When does the train leave?',
        'Is this the station?',
        'How much is a ticket?',
      ],
      correctAnswer: 'Where is the station?',
      explanation: 'どこ means where, and 駅 means station.',
    },
  ],
  translation: [
    {
      type: 'translation',
      title: 'Introducing your name',
      japanese: 'はじめまして。アナです。',
      romaji: 'Hajimemashite. Ana desu.',
      englishContext: 'You are introducing yourself for the first time.',
      tags: ['greetings', 'self_intro'],
      difficulty: 1,
      direction: 'ja_to_en',
      prompt: 'Translate this to English: はじめまして。アナです。',
      expectedAnswer: 'Nice to meet you. I am Ana.',
      acceptedAnswers: [
        'Nice to meet you. I am Ana.',
        "Nice to meet you. I'm Ana.",
        'How do you do? I am Ana.',
      ],
    },
    {
      type: 'translation',
      title: 'Buying a train ticket',
      japanese: '東京までの切符をください。',
      romaji: 'Tokyo made no kippu o kudasai.',
      englishContext: 'You are buying a ticket at a station counter.',
      tags: ['travel', 'transport', 'request'],
      difficulty: 2,
      direction: 'en_to_ja',
      prompt: 'Translate to Japanese: Please give me a ticket to Tokyo.',
      expectedAnswer: '東京までの切符をください。',
      expectedRomaji: 'Tokyo made no kippu o kudasai.',
      acceptedAnswers: ['東京までの切符をください。', '東京までのきっぷをください。'],
    },
  ],
  fill_blank: [
    {
      type: 'fill_blank',
      title: 'Morning routine',
      japanese: '毎朝、___を飲みます。',
      romaji: 'Maiasa, ___ o nomimasu.',
      englishContext: 'You describe your daily morning habit.',
      tags: ['daily_life', 'routine'],
      difficulty: 1,
      sentence: '毎朝、___を飲みます。',
      sentenceRomaji: 'Maiasa, ___ o nomimasu.',
      sentenceEnglish: 'Every morning, I drink ___.',
      blank: '___',
      answer: 'コーヒー',
      answerRomaji: 'Koohii',
    },
    {
      type: 'fill_blank',
      title: 'At the station',
      japanese: '新宿___行きます。',
      romaji: 'Shinjuku ___ ikimasu.',
      englishContext: 'You are saying where you are going.',
      tags: ['travel', 'grammar_particle'],
      difficulty: 2,
      sentence: '新宿___行きます。',
      sentenceRomaji: 'Shinjuku ___ ikimasu.',
      sentenceEnglish: 'I go to Shinjuku.',
      blank: '___',
      answer: 'に',
      answerRomaji: 'ni',
    },
  ],
  reorder: [
    {
      type: 'reorder',
      title: 'Simple location question',
      japanese: 'トイレはどこですか。',
      romaji: 'Toire wa doko desu ka.',
      englishContext: 'You ask where the restroom is.',
      tags: ['travel', 'question', 'daily_life'],
      difficulty: 1,
      prompt: 'Reorder the tokens into a natural Japanese question: Where is the restroom?',
      tokens: ['ですか', 'どこ', 'トイレ', 'は'],
      correctOrder: ['トイレ', 'は', 'どこ', 'ですか'],
    },
    {
      type: 'reorder',
      title: 'Ordering lunch',
      japanese: '昼ごはんを食べます。',
      romaji: 'Hirugohan o tabemasu.',
      englishContext: 'You are saying you will eat lunch.',
      tags: ['daily_life', 'food'],
      difficulty: 1,
      prompt: 'Reorder the tokens: I eat lunch.',
      tokens: ['食べます', 'を', '昼ごはん'],
      correctOrder: ['昼ごはん', 'を', '食べます'],
    },
  ],
  reading: [
    {
      type: 'reading',
      title: 'Hotel check-in note',
      japanese: 'ホテルに着きました。フロントで名前を言って、鍵をもらいました。部屋は五階です。',
      romaji:
        'Hoteru ni tsukimashita. Furonto de namae o itte, kagi o moraimashita. Heya wa gokai desu.',
      englishContext: 'A short story about arriving at a hotel.',
      tags: ['travel', 'hotel', 'reading'],
      difficulty: 2,
      passage: 'ホテルに着きました。フロントで名前を言って、鍵をもらいました。部屋は五階です。',
      passageRomaji:
        'Hoteru ni tsukimashita. Furonto de namae o itte, kagi o moraimashita. Heya wa gokai desu.',
      passageEnglish:
        'I arrived at the hotel. I said my name at the front desk and got a key. The room is on the fifth floor.',
      question: 'Where is the hotel room?',
      answer: 'It is on the fifth floor.',
    },
    {
      type: 'reading',
      title: 'Morning commute',
      japanese:
        '今日は七時に起きました。駅まで歩いて、八時の電車に乗りました。会社には八時半に着きました。',
      romaji:
        'Kyou wa shichiji ni okimashita. Eki made aruite, hachiji no densha ni norimashita. Kaisha ni wa hachiji han ni tsukimashita.',
      englishContext: 'A short text about commuting to work.',
      tags: ['daily_life', 'time', 'transport'],
      difficulty: 2,
      passage:
        '今日は七時に起きました。駅まで歩いて、八時の電車に乗りました。会社には八時半に着きました。',
      passageRomaji:
        'Kyou wa shichiji ni okimashita. Eki made aruite, hachiji no densha ni norimashita. Kaisha ni wa hachiji han ni tsukimashita.',
      passageEnglish:
        'Today I woke up at 7. I walked to the station and took the 8 o clock train. I arrived at the office at 8:30.',
      question: 'What time did the writer arrive at the office?',
      answer: 'At 8:30.',
    },
  ],
  listening: [
    {
      type: 'listening',
      title: 'Train platform announcement',
      japanese: '次の電車は三番線に来ます。',
      romaji: 'Tsugi no densha wa sanbansen ni kimasu.',
      englishContext: 'You hear an announcement at a station.',
      tags: ['travel', 'listening', 'transport'],
      difficulty: 2,
      prompt: 'Listen and choose the correct meaning.',
      audioText: '次の電車は三番線に来ます。',
      choices: [
        'The next train arrives at platform 3.',
        'The third train is late.',
        'Please go to platform 2.',
        'The train departs in 3 minutes.',
      ],
      correctAnswer: 'The next train arrives at platform 3.',
    },
    {
      type: 'listening',
      title: 'Cafe order',
      japanese: 'サンドイッチとお茶をお願いします。',
      romaji: 'Sandoicchi to ocha o onegaishimasu.',
      englishContext: 'A customer is placing an order in a cafe.',
      tags: ['daily_life', 'food', 'listening'],
      difficulty: 1,
      prompt: 'What does the speaker order?',
      audioText: 'サンドイッチとお茶をお願いします。',
      choices: ['A sandwich and tea', 'Two sandwiches', 'Tea and cake', 'A sandwich and coffee'],
      correctAnswer: 'A sandwich and tea',
    },
  ],
};

export function getDebugExercises(type: ExerciseType, count = 6): Exercise[] {
  const templates = DEBUG_EXERCISE_TEMPLATES[type];
  if (!templates || count <= 0) {
    return [];
  }

  return Array.from({ length: count }, (_, index) => {
    const template = templates[index % templates.length];
    return {
      ...template,
      id: `debug-${type}-${randomUUID()}`,
    } as Exercise;
  });
}

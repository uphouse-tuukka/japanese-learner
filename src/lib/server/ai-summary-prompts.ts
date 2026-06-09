import type { AiPromptMessage } from '$lib/server/ai-session-prompts';
import type { Exercise, SessionSummary, UserLevel } from '$lib/types';

export type SessionSummaryPromptInput = {
  sessionId: string;
  userId: string;
  userLevel: UserLevel;
  japaneseWritingEnabled?: boolean;
  lessonTopic?: string;
  progressJournal?: string | null;
  suppressPromotion?: boolean;
  recentSessions?: Array<{
    topic: string;
    accuracy: number;
    keyPhrases: string[];
    exerciseTypes: string[];
  }>;
  exercises: Exercise[];
  results: Array<{
    exerciseId: string;
    answerText: string;
    isCorrect: boolean;
  }>;
};

export type SessionSummaryPrompt = {
  messages: AiPromptMessage[];
  accuracy: number;
};

export type UpdatedJournalPromptInput = {
  currentJournal: string | null;
  sessionSummary: SessionSummary;
  sessionMeta: { category?: string; topic: string; exerciseTypes: string[]; keyPhrases: string[] };
  userLevel: UserLevel;
};

export type UpdatedJournalPrompt = {
  messages: AiPromptMessage[];
};

function getExpectedAnswerDetails(exercise: Exercise | undefined): {
  expectedAnswer: string;
  acceptedAnswers: string[];
} {
  if (!exercise) {
    return {
      expectedAnswer: '',
      acceptedAnswers: [],
    };
  }

  if (exercise.type === 'multiple_choice') {
    return {
      expectedAnswer: exercise.correctAnswer,
      acceptedAnswers: [exercise.correctAnswer],
    };
  }

  if (exercise.type === 'translation') {
    return {
      expectedAnswer: exercise.expectedAnswer,
      acceptedAnswers: exercise.acceptedAnswers,
    };
  }

  if (exercise.type === 'fill_blank') {
    return {
      expectedAnswer: exercise.answer,
      acceptedAnswers: [exercise.answer, exercise.answerRomaji],
    };
  }

  if (exercise.type === 'reorder') {
    const reorderedAnswer = exercise.correctOrder.join(' ');
    return {
      expectedAnswer: reorderedAnswer,
      acceptedAnswers: [reorderedAnswer],
    };
  }

  if (exercise.type === 'reading') {
    return {
      expectedAnswer: exercise.answer,
      acceptedAnswers: [exercise.answer],
    };
  }

  if (exercise.type === 'listening') {
    return {
      expectedAnswer: exercise.correctAnswer,
      acceptedAnswers: [exercise.correctAnswer],
    };
  }

  return {
    expectedAnswer: exercise.expectedAnswer,
    acceptedAnswers: exercise.acceptedAnswers,
  };
}

export function buildSessionSummaryPrompt(input: SessionSummaryPromptInput): SessionSummaryPrompt {
  const accuracy =
    input.results.length === 0
      ? 0
      : Math.round(
          (input.results.filter((row) => row.isCorrect).length / input.results.length) * 100,
        );

  const exercisesById = new Map<string, Exercise>();
  for (const exercise of input.exercises) {
    exercisesById.set(exercise.id, exercise);
  }

  const detailedResults = input.results.map((result) => {
    const exercise = exercisesById.get(result.exerciseId);
    const expectedAnswerDetails = getExpectedAnswerDetails(exercise);
    return {
      exerciseId: result.exerciseId,
      type: exercise?.type ?? 'unknown',
      title: exercise?.title ?? 'Unknown exercise',
      prompt: exercise?.englishContext ?? '',
      answerText: result.answerText,
      expectedAnswer: expectedAnswerDetails.expectedAnswer,
      acceptedAnswers: expectedAnswerDetails.acceptedAnswers,
      isCorrect: result.isCorrect,
    };
  });

  const recentSessionsCompact = (input.recentSessions ?? []).map((session) => ({
    topic: session.topic,
    accuracy: session.accuracy,
    keyPhrases: (session.keyPhrases ?? []).slice(0, 5),
    exerciseTypes: session.exerciseTypes ?? [],
  }));

  const progressContextBlocks: string[] = [];
  if (typeof input.progressJournal === 'string' && input.progressJournal.trim()) {
    progressContextBlocks.push(
      `LEARNER PROGRESS JOURNAL (cumulative history):\n${input.progressJournal.trim()}\n`,
    );
  }
  if (recentSessionsCompact.length > 0) {
    progressContextBlocks.push(
      `RECENT SESSIONS (last ${recentSessionsCompact.length}):\n${JSON.stringify(recentSessionsCompact)}\n`,
    );
  }

  const currentSessionData = {
    sessionId: input.sessionId,
    userId: input.userId,
    userLevel: input.userLevel,
    japaneseWritingEnabled: input.japaneseWritingEnabled ?? false,
    lessonTopic: input.lessonTopic ?? 'travel_japanese',
    accuracy,
    exercises: input.exercises.map((exercise) => ({
      id: exercise.id,
      type: exercise.type,
      title: exercise.title,
      japanese: exercise.japanese,
      romaji: exercise.romaji,
      englishContext: exercise.englishContext,
      difficulty: exercise.difficulty,
    })),
    results: detailedResults,
  };

  return {
    messages: [
      {
        role: 'system',
        content: [
          'You are a Japanese tutor providing a concise end-of-session learner summary plus internal handoff notes.',
          'Write ALL learner-visible summary text in English. The summary, patterns_strong, patterns_weak, mini_lesson.english, and mini_lesson.note fields must be in English.',
          'Return JSON only with keys: summary, patterns_strong, patterns_weak, mini_lesson, handoff_notes, levelUpRecommendation.',
          '',
          'RULES:',
          '1) Only reference exercises that appear in the provided session data. Never fabricate.',
          'summary: This is the short top recap shown under the score. Write 1-3 concise sentences, 35-60 words maximum. Do NOT make summary exercise-by-exercise feedback, an essay, or a duplicate of patterns_strong, patterns_weak, or mini_lesson.',
          '2) patterns_strong: Identify PATTERNS and skills the learner demonstrates consistently — compare with prior sessions/journal when evidence exists. Do NOT list individual correct answers. Focus on what skills are ready to build upon.',
          '3) patterns_weak: Identify conceptual gaps and confusion patterns (particle errors, verb form mistakes, similar-word confusion). Do NOT list individual wrong answers. If accuracy is 100%, mention 1-2 growth areas (nuance, range).',
          '4) mini_lesson: exactly one object with keys kind, japanese, romaji, english, note. kind must be one of: related_phrase, likely_reply, nuance_upgrade, follow_up. Keep it closely related to this completed lesson, concrete, and immediately usable. Do NOT copy a taught key phrase verbatim. Do NOT phrase it as a future promise ("next time we will...").',
          '5) handoff_notes: 0-3 short internal notes for the next session generator. Keep them specific and pattern-oriented. These are internal only and MUST NOT be written as learner-facing "next time" statements.',
          '6) All Japanese in learner-visible output must include matching romaji. Example: japanese="こんにちは", romaji="konnichiwa".',
          input.suppressPromotion
            ? '7) levelUpRecommendation: MUST be null. A promotion was recently recommended — do NOT suggest another promotion this session.'
            : '7) levelUpRecommendation: null or {recommendedLevel, reason}. Recommend promotion only with consistent mastery (>=80% recent accuracy + strong evidence across multiple sessions). Never promote ready_for_japan. Do NOT recommend promotion in consecutive sessions.',
          '',
          "TRANSLATION ACCURACY: The 'isCorrect' field uses string matching which may be imperfect. Answers conveying the same meaning ARE correct. Do not penalize natural phrasings, added politeness, contractions, or word order differences. If an 'incorrect' answer was actually correct, acknowledge it as a strength.",
          'Keep feedback encouraging, concise, and travel-focused.',
        ].join(' '),
      },
      {
        role: 'user',
        content: `${progressContextBlocks.join('\n')}CURRENT SESSION DATA:\n${JSON.stringify(currentSessionData)}`,
      },
    ],
    accuracy,
  };
}

export function buildUpdatedJournalPrompt(input: UpdatedJournalPromptInput): UpdatedJournalPrompt {
  const currentJournalText =
    typeof input.currentJournal === 'string' && input.currentJournal.trim()
      ? input.currentJournal.trim()
      : "This is the user's first session.";

  return {
    messages: [
      {
        role: 'system',
        content: [
          'Maintain a cumulative learner journal for a Japanese learning app. This journal is read by AI models to generate future sessions — optimize for machine readability, not human presentation.',
          'Write ALL journal text in English. Japanese should only appear within Vocabulary bank entries (the Japanese words/phrases themselves and their translations). Category names, topic descriptions, weak spot analysis, trajectory commentary, and progress snapshots must all be in English.',
          'Return plain text only, under 500 words.',
          'Merge the existing journal with the new session data.',
          'Use these exact headings in this order:',
          '**Categories & topics covered** — list each category with its topics (e.g., food_dining: ordering, menu items)',
          '**Vocabulary bank** — key phrases learned, capped at ~30 most recent/important. Drop older mastered items to stay under cap.',
          '**Persistent weak spots** — only patterns that keep recurring across multiple sessions. Remove items the learner has since mastered.',
          '**Progress snapshot** — session count, current level, any streak info',
          '**Learning trajectory** — 1-2 sentences on overall direction and readiness',
          'Use short bullet points under each heading.',
          'Keep content specific, evidence-based, and cumulative.',
          'Sessions completed rule: first session = 1; otherwise increment the count from the existing journal.',
          'Do NOT include romaji — this data is for AI consumption only.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `EXISTING_JOURNAL:\n${currentJournalText}`,
          'SESSION:',
          JSON.stringify({
            level: input.userLevel,
            category: input.sessionMeta.category ?? 'unknown',
            topic: input.sessionMeta.topic,
            exerciseTypes: input.sessionMeta.exerciseTypes,
            keyPhrases: input.sessionMeta.keyPhrases,
            summary: input.sessionSummary.summary,
            accuracy: input.sessionSummary.accuracy,
            strengths: input.sessionSummary.strengths,
            weaknesses: input.sessionSummary.weaknesses,
            nextSteps: input.sessionSummary.nextSteps,
          }),
        ].join('\n'),
      },
    ],
  };
}

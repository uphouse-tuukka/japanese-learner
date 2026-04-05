import OpenAI from 'openai';
import { createHmac } from 'crypto';
import { config } from '$lib/config';
import { getAuthSecret } from '$lib/server/auth';
import { generateSessionPlan } from '$lib/server/ai';
import {
  cleanupExpiredPortfolioAttempts,
  countRecentAttemptsByIp,
  countCompletedSessionsByCookie,
  countRecentAttemptsByCookie,
  recordPortfolioAttempt,
  getPortfolioSession,
  getActiveSessionByCookie,
  updatePortfolioProgress,
  updatePortfolioSummary,
  invalidateActiveSession,
  type PortfolioSessionRow,
} from '$lib/server/db';
import type { Exercise, ExerciseAnswerPayload, Lesson } from '$lib/types';

const TIMEOUT_MS = 45_000;
const SESSION_TTL_MS = 30 * 60 * 1_000;
const MAX_STARTS_PER_IP_24H = 4;
const MAX_COMPLETIONS_PER_COOKIE_24H = 2;
const TARGET_EXERCISE_COUNT = 4;
const PORTFOLIO_MODEL = 'gpt-5.4';

export const SCENARIOS = [
  { id: 'food', label: 'Food & Dining', emoji: '🍜' },
  { id: 'directions', label: 'Asking Directions', emoji: '🗺️' },
  { id: 'hotel', label: 'Hotel Check-in', emoji: '🏨' },
  { id: 'transport', label: 'Getting Around', emoji: '🚃' },
  { id: 'greetings', label: 'Greetings & Basics', emoji: '👋' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]['id'];

export type PortfolioSessionState = {
  sessionId: string;
  state: 'lesson' | 'active' | 'done';
  scenario: string;
  lesson: Lesson;
  exercises: Exercise[];
  answers: ExerciseAnswerPayload[];
  currentIndex: number;
  expiresAt: string;
  remainingSessionsToday: number;
};

export type PortfolioSummary = {
  summary: string;
  stats: {
    accuracy: number;
    totalCorrect: number;
    totalExercises: number;
    scenario: string;
    phrasesLearned: string[];
  };
  strengths: string[];
  misses: string[];
  nextSteps: string[];
  celebration: {
    type: 'accuracy_badge';
    label: string;
    emoji: string;
  };
};

export type StartSessionResult =
  | { ok: true; session: PortfolioSessionState }
  | {
      ok: false;
      reason: 'quota_exceeded' | 'generation_failed' | 'timeout' | 'invalid_scenario';
      message: string;
    };

export type GetCurrentResult =
  | { ok: true; session: PortfolioSessionState }
  | { ok: false; reason: 'no_session' | 'expired'; message: string };

export type ProgressResult =
  | { ok: true; session: PortfolioSessionState }
  | {
      ok: false;
      reason: 'invalid_session' | 'expired' | 'invalid_step' | 'already_completed';
      message: string;
    };

export type CompleteResult =
  | {
      ok: true;
      summary: PortfolioSummary;
      stats: PortfolioSummary['stats'];
      celebration: PortfolioSummary['celebration'];
    }
  | {
      ok: false;
      reason: 'invalid_session' | 'expired' | 'not_ready' | 'already_completed' | 'summary_failed';
      message: string;
    };

let openaiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) throw new Error('[portfolio] Missing OpenAI API key');
  if (!openaiClient) openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

function hashIp(ip: string): string {
  return createHmac('sha256', getAuthSecret()).update(ip).digest('hex');
}

function since24h(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
}

function scenarioToTopic(scenario: ScenarioId): string {
  const map: Record<ScenarioId, string> = {
    food: 'food_dining',
    directions: 'directions_navigation',
    hotel: 'hotel_accommodation',
    transport: 'transport',
    greetings: 'greetings_basics',
    shopping: 'shopping',
  };
  return map[scenario];
}

function isScenarioId(value: string): value is ScenarioId {
  return SCENARIOS.some((scenario) => scenario.id === value);
}

function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true });
  });
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw new Error('timeout');
  }
  return Promise.race([promise, waitForAbort(signal)]);
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isBaseExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const exercise = value as Record<string, unknown>;
  if (typeof exercise.id !== 'string' || !exercise.id.trim()) return false;
  if (typeof exercise.title !== 'string') return false;
  if (typeof exercise.japanese !== 'string') return false;
  if (typeof exercise.romaji !== 'string') return false;
  if (typeof exercise.englishContext !== 'string') return false;
  if (!Array.isArray(exercise.tags) || !exercise.tags.every((tag) => typeof tag === 'string')) {
    return false;
  }
  if (typeof exercise.difficulty !== 'number') return false;
  return true;
}

function isValidExercise(value: unknown): value is Exercise {
  if (!isBaseExercise(value)) {
    return false;
  }
  const exercise = value as Exercise;
  if (exercise.type === 'multiple_choice') {
    return (
      typeof exercise.question === 'string' &&
      Array.isArray(exercise.choices) &&
      exercise.choices.every((choice) => typeof choice === 'string') &&
      typeof exercise.correctAnswer === 'string'
    );
  }
  if (exercise.type === 'translation') {
    return (
      (exercise.direction === 'en_to_ja' || exercise.direction === 'ja_to_en') &&
      typeof exercise.prompt === 'string' &&
      typeof exercise.expectedAnswer === 'string' &&
      Array.isArray(exercise.acceptedAnswers)
    );
  }
  if (exercise.type === 'fill_blank') {
    return (
      typeof exercise.sentence === 'string' &&
      typeof exercise.sentenceRomaji === 'string' &&
      typeof exercise.sentenceEnglish === 'string' &&
      typeof exercise.blank === 'string' &&
      typeof exercise.answer === 'string' &&
      typeof exercise.answerRomaji === 'string'
    );
  }
  if (exercise.type === 'reorder') {
    return (
      typeof exercise.prompt === 'string' &&
      Array.isArray(exercise.tokens) &&
      Array.isArray(exercise.correctOrder)
    );
  }
  if (exercise.type === 'reading') {
    return (
      typeof exercise.passage === 'string' &&
      typeof exercise.passageRomaji === 'string' &&
      typeof exercise.passageEnglish === 'string' &&
      typeof exercise.question === 'string' &&
      typeof exercise.answer === 'string'
    );
  }
  if (exercise.type === 'listening') {
    return (
      typeof exercise.prompt === 'string' &&
      typeof exercise.audioText === 'string' &&
      Array.isArray(exercise.choices) &&
      typeof exercise.correctAnswer === 'string'
    );
  }
  return false;
}

function repairExercises(exercises: Exercise[], supportsBrowserVoice: boolean): Exercise[] {
  const repaired: Exercise[] = [];
  for (const exercise of exercises) {
    if (!supportsBrowserVoice && exercise.type === 'listening') {
      continue;
    }
    if (!isValidExercise(exercise)) {
      continue;
    }
    repaired.push(exercise);
  }
  return repaired.slice(0, TARGET_EXERCISE_COUNT);
}

function getSessionState(
  status: string,
  currentStep: number,
  totalExercises: number,
): 'lesson' | 'active' | 'done' {
  if (status === 'completed' || currentStep >= totalExercises) {
    return 'done';
  }
  if (currentStep <= 0) {
    return 'lesson';
  }
  return 'active';
}

async function getRemainingSessionsToday(cookieId: string): Promise<number> {
  const completedCount = await countCompletedSessionsByCookie(cookieId, since24h());
  return Math.max(0, MAX_COMPLETIONS_PER_COOKIE_24H - completedCount);
}

async function buildSessionStateFromRow(
  row: PortfolioSessionRow,
  cookieId: string,
): Promise<PortfolioSessionState> {
  const lesson = safeParseJson<Lesson | null>(row.lesson, null);
  const exercises = safeParseJson<Exercise[]>(row.exercises, []);
  const answers = safeParseJson<ExerciseAnswerPayload[]>(row.answers, []);

  if (!lesson || !Array.isArray(exercises) || exercises.length === 0) {
    throw new Error('invalid_session_payload');
  }

  return {
    sessionId: row.id,
    state: getSessionState(row.status, row.currentStep, exercises.length),
    scenario: row.scenario ?? 'unknown',
    lesson,
    exercises,
    answers,
    currentIndex: row.currentStep,
    expiresAt: row.expiresAt,
    remainingSessionsToday: await getRemainingSessionsToday(cookieId),
  };
}

function computeStats(
  scenario: string,
  lesson: Lesson,
  exercises: Exercise[],
  answers: ExerciseAnswerPayload[],
): PortfolioSummary['stats'] {
  const totalExercises = exercises.length;
  const totalCorrect = answers.slice(0, totalExercises).filter((answer) => answer.isCorrect).length;
  const accuracy = totalExercises > 0 ? Math.round((totalCorrect / totalExercises) * 100) : 0;
  return {
    accuracy,
    totalCorrect,
    totalExercises,
    scenario,
    phrasesLearned: lesson.keyPhrases.map((phrase) => phrase.japanese),
  };
}

function buildCelebration(accuracy: number): PortfolioSummary['celebration'] {
  if (accuracy === 100) {
    return { type: 'accuracy_badge', label: 'Perfect Score', emoji: '🌟' };
  }
  if (accuracy >= 75) {
    return { type: 'accuracy_badge', label: 'Great Work', emoji: '✨' };
  }
  return { type: 'accuracy_badge', label: 'Session Complete', emoji: '🎌' };
}

function buildDeterministicSummary(
  scenario: string,
  lesson: Lesson,
  exercises: Exercise[],
  answers: ExerciseAnswerPayload[],
): PortfolioSummary {
  const stats = computeStats(scenario, lesson, exercises, answers);
  const celebration = buildCelebration(stats.accuracy);

  return {
    summary: `You completed a ${scenario} demo session on "${lesson.topic}" with ${stats.totalCorrect}/${stats.totalExercises} correct answers.`,
    stats,
    strengths:
      stats.totalCorrect > 0
        ? [
            'You completed the session and answered several prompts correctly.',
            'You stayed on-topic throughout the lesson.',
          ]
        : [
            'You completed the full demo session.',
            'You were exposed to practical beginner travel phrases.',
          ],
    misses:
      stats.totalCorrect === stats.totalExercises
        ? ['No major misses this round.']
        : ['Review the items marked incorrect and compare them with the lesson key phrases.'],
    nextSteps: [
      'Repeat this scenario and aim for faster, more confident answers.',
      'Say each key phrase out loud with romaji to build speaking fluency.',
    ],
    celebration,
  };
}

async function generatePublicSummary(
  scenario: string,
  lesson: Lesson,
  exercises: Exercise[],
  answers: ExerciseAnswerPayload[],
): Promise<{ summary: string; strengths: string[]; misses: string[]; nextSteps: string[] }> {
  const client = getOpenAiClient();
  const promptPayload = {
    scenario,
    lessonTopic: lesson.topic,
    exercises: exercises.map((exercise) => ({
      type: exercise.type,
      title: exercise.title,
      englishContext: exercise.englishContext,
    })),
    results: answers.map((answer) => ({
      answerText: answer.answerText,
      isCorrect: answer.isCorrect,
    })),
  };

  try {
    const response = await client.responses.create({
      model: PORTFOLIO_MODEL,
      temperature: 0.3,
      input: [
        {
          role: 'system',
          content:
            'You are a Japanese tutor giving a brief, encouraging recap of a short demo session. Return JSON with keys: summary, strengths, misses, nextSteps. Keep it concise — 2-3 items per list. All text in English. Any Japanese references should include romaji in parentheses.',
        },
        {
          role: 'user',
          content: JSON.stringify(promptPayload),
        },
      ],
      text: {
        format: {
          type: 'json_object',
        },
      },
    });

    const parsed = safeParseJson<Record<string, unknown> | null>(
      response.output_text ?? null,
      null,
    );
    if (!parsed) {
      throw new Error('empty_summary');
    }

    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const strengths = Array.isArray(parsed.strengths)
      ? parsed.strengths.filter((item): item is string => typeof item === 'string').slice(0, 3)
      : [];
    const misses = Array.isArray(parsed.misses)
      ? parsed.misses.filter((item): item is string => typeof item === 'string').slice(0, 3)
      : [];
    const nextSteps = Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.filter((item): item is string => typeof item === 'string').slice(0, 3)
      : [];

    if (!summary) {
      throw new Error('missing_summary');
    }

    return {
      summary,
      strengths: strengths.length
        ? strengths
        : ['You completed the session and practiced useful phrases.'],
      misses: misses.length ? misses : ['Review incorrect answers and retry this scenario.'],
      nextSteps: nextSteps.length
        ? nextSteps
        : ['Replay this scenario and focus on the missed items.'],
    };
  } catch (error) {
    console.warn('[portfolio]', 'Public summary generation failed, using fallback', {
      error: (error as Error).message,
    });
    const fallback = buildDeterministicSummary(scenario, lesson, exercises, answers);
    return {
      summary: fallback.summary,
      strengths: fallback.strengths,
      misses: fallback.misses,
      nextSteps: fallback.nextSteps,
    };
  }
}

export async function startSession(
  cookieId: string | undefined,
  ip: string,
  scenario: ScenarioId,
  supportsBrowserVoice: boolean,
): Promise<StartSessionResult> {
  if (!isScenarioId(scenario)) {
    return {
      ok: false,
      reason: 'invalid_scenario',
      message: 'Invalid scenario.',
    };
  }

  void cleanupExpiredPortfolioAttempts().catch(console.error);

  const ipHash = hashIp(ip);
  const resolvedCookieId = cookieId ?? `anon-${ipHash.slice(0, 12)}`;
  const since = since24h();

  const [ipAttempts, completedCount, recentCookieStarts] = await Promise.all([
    countRecentAttemptsByIp(ipHash, since),
    countCompletedSessionsByCookie(resolvedCookieId, since),
    countRecentAttemptsByCookie(resolvedCookieId, since),
  ]);

  if (ipAttempts >= MAX_STARTS_PER_IP_24H) {
    return {
      ok: false,
      reason: 'quota_exceeded',
      message: 'Too many session starts from this IP. Please try again later.',
    };
  }

  if (completedCount >= MAX_COMPLETIONS_PER_COOKIE_24H) {
    return {
      ok: false,
      reason: 'quota_exceeded',
      message: 'You reached today’s completed session limit. Please come back tomorrow.',
    };
  }

  await invalidateActiveSession(resolvedCookieId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), TIMEOUT_MS);

  try {
    let lesson: Lesson | null = null;
    let exercises: Exercise[] = [];

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const plan = await withAbort(
        generateSessionPlan({
          userId: 'portfolio-visitor',
          userName: 'Visitor',
          userLevel: 'beginner',
          exerciseCount: 6,
          sessionHistory: [],
          recentAccuracy: undefined,
          coveredTopics: [scenarioToTopic(scenario)],
          totalSessionCount: 0,
        }),
        controller.signal,
      );

      const repaired = repairExercises(plan.exercises, supportsBrowserVoice);
      if (repaired.length >= TARGET_EXERCISE_COUNT) {
        lesson = plan.lesson;
        exercises = repaired.slice(0, TARGET_EXERCISE_COUNT);
        break;
      }

      console.warn('[portfolio]', 'Exercise repair left too few exercises, retrying', {
        attempt,
        scenario,
        supportsBrowserVoice,
        generatedCount: plan.exercises.length,
        repairedCount: repaired.length,
        recentCookieStarts,
      });
    }

    if (!lesson || exercises.length < TARGET_EXERCISE_COUNT) {
      return {
        ok: false,
        reason: 'generation_failed',
        message: 'Could not build a complete demo session right now. Please try again.',
      };
    }

    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const attempt = await recordPortfolioAttempt({
      cookieId: resolvedCookieId,
      ipHash,
      expiresAt,
      scenario,
      lesson: JSON.stringify(lesson),
      exercises: JSON.stringify(exercises),
      supportsBrowserVoice,
    });

    const remainingSessionsToday = Math.max(0, MAX_COMPLETIONS_PER_COOKIE_24H - completedCount);

    return {
      ok: true,
      session: {
        sessionId: attempt.id,
        state: 'lesson',
        scenario,
        lesson,
        exercises,
        answers: [],
        currentIndex: 0,
        expiresAt,
        remainingSessionsToday,
      },
    };
  } catch (error) {
    if (controller.signal.aborted) {
      console.warn('[portfolio]', 'Session generation timed out');
      return {
        ok: false,
        reason: 'timeout',
        message: 'Session generation timed out. Please try again.',
      };
    }
    console.warn('[portfolio]', 'Session generation failed', { error: (error as Error).message });
    return {
      ok: false,
      reason: 'generation_failed',
      message: 'Could not generate a session right now. Please try again.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getCurrentSession(cookieId: string): Promise<GetCurrentResult> {
  const row = await getActiveSessionByCookie(cookieId);
  if (!row) {
    return { ok: false, reason: 'no_session', message: 'No active session found.' };
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', message: 'Session expired. Please start a new one.' };
  }

  try {
    return { ok: true, session: await buildSessionStateFromRow(row, cookieId) };
  } catch {
    return { ok: false, reason: 'no_session', message: 'Session is no longer available.' };
  }
}

export async function progressSession(
  sessionId: string,
  cookieId: string,
  currentIndex: number,
  answer: ExerciseAnswerPayload,
): Promise<ProgressResult> {
  const row = await getPortfolioSession(sessionId);
  if (!row || row.cookieId !== cookieId) {
    return { ok: false, reason: 'invalid_session', message: 'Session not found.' };
  }

  if (row.status === 'completed') {
    return { ok: false, reason: 'already_completed', message: 'Session already completed.' };
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', message: 'Session expired. Please start a new one.' };
  }

  if (row.status !== 'started') {
    return { ok: false, reason: 'invalid_session', message: 'Session is not active.' };
  }

  const exercises = safeParseJson<Exercise[]>(row.exercises, []);
  if (currentIndex < 0 || currentIndex >= exercises.length) {
    return { ok: false, reason: 'invalid_step', message: 'Invalid exercise index.' };
  }

  const answers = safeParseJson<ExerciseAnswerPayload[]>(row.answers, []);
  const isIdempotentReplay =
    currentIndex === row.currentStep - 1 && currentIndex < answers.length && currentIndex >= 0;
  const isExpectedNext = currentIndex === row.currentStep;

  if (!isExpectedNext && !isIdempotentReplay) {
    return { ok: false, reason: 'invalid_step', message: 'Out-of-order exercise submission.' };
  }

  const updatedAnswers = [...answers];
  updatedAnswers[currentIndex] = answer;
  const nextStep = Math.max(row.currentStep, currentIndex + 1);
  await updatePortfolioProgress(sessionId, nextStep, JSON.stringify(updatedAnswers));

  const refreshed = await getPortfolioSession(sessionId);
  if (!refreshed) {
    return { ok: false, reason: 'invalid_session', message: 'Session not found after update.' };
  }

  try {
    return { ok: true, session: await buildSessionStateFromRow(refreshed, cookieId) };
  } catch {
    return { ok: false, reason: 'invalid_session', message: 'Session payload is invalid.' };
  }
}

export async function completeSession(
  sessionId: string,
  cookieId: string,
): Promise<CompleteResult> {
  const row = await getPortfolioSession(sessionId);
  if (!row || row.cookieId !== cookieId) {
    return { ok: false, reason: 'invalid_session', message: 'Session not found.' };
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expired', message: 'Session expired. Please start a new one.' };
  }

  const lesson = safeParseJson<Lesson | null>(row.lesson, null);
  const exercises = safeParseJson<Exercise[]>(row.exercises, []);
  const answers = safeParseJson<ExerciseAnswerPayload[]>(row.answers, []);
  const scenario = row.scenario ?? 'unknown';

  if (!lesson || exercises.length === 0) {
    return { ok: false, reason: 'invalid_session', message: 'Session data is invalid.' };
  }

  if (row.status === 'completed') {
    const existingSummary = safeParseJson<PortfolioSummary | null>(row.summary, null);
    if (existingSummary) {
      return {
        ok: true,
        summary: existingSummary,
        stats: existingSummary.stats,
        celebration: existingSummary.celebration,
      };
    }

    return { ok: false, reason: 'already_completed', message: 'Session already completed.' };
  }

  if (row.currentStep < exercises.length || answers.length < exercises.length) {
    return { ok: false, reason: 'not_ready', message: 'Finish all exercises before completing.' };
  }

  let summaryData: { summary: string; strengths: string[]; misses: string[]; nextSteps: string[] };
  try {
    summaryData = await generatePublicSummary(scenario, lesson, exercises, answers);
  } catch (error) {
    console.warn('[portfolio]', 'Summary generation failed unexpectedly', {
      error: (error as Error).message,
    });
    return { ok: false, reason: 'summary_failed', message: 'Could not create session summary.' };
  }

  const stats = computeStats(scenario, lesson, exercises, answers);
  const summary: PortfolioSummary = {
    summary: summaryData.summary,
    stats,
    strengths: summaryData.strengths,
    misses: summaryData.misses,
    nextSteps: summaryData.nextSteps,
    celebration: buildCelebration(stats.accuracy),
  };

  await updatePortfolioSummary(sessionId, JSON.stringify(summary));

  return {
    ok: true,
    summary,
    stats: summary.stats,
    celebration: summary.celebration,
  };
}

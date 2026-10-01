import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateSessionPlan } from '$lib/server/ai';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import {
  attachExercisesToSession,
  createSessionRecord,
  deleteStaleGhostSessions,
  getCompletedAiExerciseResultsForUser,
  getCompletedAiSessionsForUser,
  getExerciseResultsForUser,
  getSessionsForUser,
} from '$lib/server/db';
import { validateGeneratedSessionPlan } from '$lib/server/session-curriculum-validation';
import {
  buildCoverageEvidence,
  parseCoverageSourceSessions,
  type CoverageEvidence,
} from '$lib/server/session-coverage-evidence';
import { checkBudget, recordUsageEvent } from '$lib/server/token-limiter';
import { withAbort } from '$lib/server/async';
import { resolveSessionGenerationTimeoutMs } from '$lib/server/config';
import { logError, logInfo, logWarn } from '$lib/server/logger';
import { matchSelectedUser } from '$lib/server/selected-user';
import { getUser } from '$lib/server/users';
import { parseSessionMeta } from '$lib/validators/session-meta';
import { buildPlannedSessionCoverage } from '$lib/validators/planned-session-coverage';
import { isTopicCategoryKey } from '$lib/topic-categories';
import type { Exercise, Lesson, Session, SessionMiniLesson } from '$lib/types';

type GenerateRequest = {
  userId?: string;
  exerciseCount?: number;
};

type GenerateResponse = {
  ok: boolean;
  state: 'active' | 'budget_exhausted';
  session: Session | null;
  lesson: Lesson | null;
  exercises: Exercise[];
  budgetInfo?: Awaited<ReturnType<typeof checkBudget>>;
  error?: string;
};

type SessionHistoryItem = {
  date: string;
  category?: string;
  topic: string;
  accuracy: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps?: string[];
  handoffNotes?: string[];
  culturalNote?: string;
  miniLesson?: SessionMiniLesson | null;
  keyPhrases: string[];
};

const MAX_GENERATION_ATTEMPTS = 2;

type FailedGenerationUsage = { model: string; input: number; output: number };

type AcceptedGeneration = {
  plan: Awaited<ReturnType<typeof generateSessionPlan>>;
  plannedCoverage: ReturnType<typeof buildPlannedSessionCoverage>;
};

type GenerationStage = 'generation' | 'curriculum_validation' | 'planned_coverage';
type RequestStage =
  | GenerationStage
  | 'request_validation'
  | 'stale_session_cleanup'
  | 'budget_check'
  | 'user_lookup'
  | 'history_loading'
  | 'coverage_evidence'
  | 'performance_loading'
  | 'generation_config'
  | 'rejected_usage_recording'
  | 'session_creation'
  | 'exercise_attachment'
  | 'accepted_usage_recording';

class SessionGenerationTimeoutError extends Error {}

function providerHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = error.status;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599
    ? status
    : null;
}

function curriculumDiagnosticContext(coverageEvidence: CoverageEvidence) {
  return {
    totalCompletedAiSessions: coverageEvidence.source.totalCompletedAiSessions,
    parseableCompletedAiSessions: coverageEvidence.source.parseableCompletedAiSessions,
    ignoredCompletedAiSessions: coverageEvidence.source.ignoredCompletedAiSessions,
    selectedCategory: coverageEvidence.categoryRotation.selectedCategory,
    categorySelectionReason: coverageEvidence.categoryRotation.selectionReason,
    selectedLearningObjectiveId: coverageEvidence.learningObjectiveSelection.objective.id,
    learningObjectiveSelectionReason: coverageEvidence.learningObjectiveSelection.reason,
    reviewCandidateReasonCodes:
      coverageEvidence.learningObjectiveSelection.reviewCandidate?.reasonCodes ?? [],
    reviewCandidateType: coverageEvidence.learningObjectiveSelection.reviewCandidate?.type ?? null,
    reviewCandidateResolutionState: coverageEvidence.learningObjectiveSelection.reviewCandidate
      ? 'eligible_unresolved'
      : 'none_selected',
  };
}

function failedGenerationUsage(error: unknown): FailedGenerationUsage | null {
  if (!error || typeof error !== 'object' || !('generationUsage' in error)) return null;
  const usage = error.generationUsage;
  if (!usage || typeof usage !== 'object') return null;
  const model = 'model' in usage ? usage.model : null;
  const input = 'input' in usage ? usage.input : null;
  const output = 'output' in usage ? usage.output : null;
  if (typeof model !== 'string' || typeof input !== 'number' || typeof output !== 'number') {
    return null;
  }
  return { model, input, output };
}

async function generateSessionPlanWithTimeout(
  input: Parameters<typeof generateSessionPlan>[0],
  timeoutMs: number,
): ReturnType<typeof generateSessionPlan> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);

  try {
    return await withAbort(
      generateSessionPlan(input, { signal: controller.signal }),
      controller.signal,
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new SessionGenerationTimeoutError('timeout', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function legacySummaryToHistory(summary: string): SessionHistoryItem {
  return {
    date: new Date().toISOString(),
    topic: 'travel_japanese',
    accuracy: 0,
    strengths: [],
    weaknesses: [],
    nextSteps: [],
    keyPhrases: summary.trim() ? [summary.trim().slice(0, 120)] : [],
  };
}

function validationFeedbackForRetry(
  validation: ReturnType<typeof validateGeneratedSessionPlan>,
): string[] {
  if (validation.valid) return [];
  const feedback = [
    `Previous generation violated curriculum rails: ${validation.reasonCodes.join(', ')}.`,
    `Lesson category must be exactly "${validation.details.selectedCategory}".`,
  ];
  if (validation.reasonCodes.includes('repeated_lesson_topic')) {
    feedback.push('Choose a fresh exact lesson topic unless it is an explicit Review Candidate.');
  }
  if (
    validation.reasonCodes.includes('invalid_learning_objective_identity') ||
    validation.reasonCodes.includes('learning_objective_mismatch') ||
    validation.reasonCodes.includes('repeated_learning_objective')
  ) {
    feedback.push(
      validation.details.selectedLearningObjectiveId
        ? `Use Learning Objective identity exactly "${validation.details.selectedLearningObjectiveId}".`
        : 'Use the app-selected canonical Learning Objective identity exactly.',
    );
  }
  if (validation.reasonCodes.includes('ineligible_review')) {
    feedback.push(
      'Intentional review must identify the exact app-selected eligible Review Candidate and Learning Objective, with a fresh transfer task.',
    );
  }
  if (validation.reasonCodes.includes('repeated_key_phrases')) {
    if (validation.details.repeatedNonReviewKeyPhrases.length > 0) {
      feedback.push(
        `Replace these rejected Lesson Key Phrases with fresh phrases: ${validation.details.repeatedNonReviewKeyPhrases.join('; ')}.`,
      );
    }
    feedback.push(
      'Do not repeat any covered Lesson Key Phrase unless it is the explicitly selected Review Candidate.',
    );
  }
  return feedback;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  let stage: RequestStage = 'request_validation';
  let generationAttempt: number | null = null;
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as GenerateRequest;
    const userIdResult = requireStringField(body, 'userId');
    if (!userIdResult.ok) {
      return jsonError(userIdResult.error, 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const exerciseCount = Math.min(Math.max(Number(body.exerciseCount ?? 6), 4), 12);

    stage = 'stale_session_cleanup';
    await deleteStaleGhostSessions(userId);

    stage = 'budget_check';
    const budgetCheck = await checkBudget(userId);
    if (!budgetCheck.allowed) {
      const response: GenerateResponse = {
        ok: true,
        state: 'budget_exhausted',
        session: null,
        lesson: null,
        exercises: [],
        budgetInfo: budgetCheck,
      };
      return json(response, { status: 429 });
    }

    stage = 'user_lookup';
    const user = await getUser(userId);
    if (!user) {
      return jsonError('User not found.', 404);
    }

    stage = 'history_loading';
    const priorSessions = await getSessionsForUser(userId, 10);
    const completedAiSessions = await getCompletedAiSessionsForUser(userId);
    const completedAiExerciseResults = await getCompletedAiExerciseResultsForUser(userId);
    stage = 'coverage_evidence';
    const parsedCoverageSources = parseCoverageSourceSessions(completedAiSessions);
    const coverageEvidence = buildCoverageEvidence({
      sessions: parsedCoverageSources.sessions,
      totalCompletedAiSessionCount: parsedCoverageSources.totalCompletedAiSessions,
      ignoredCompletedAiSessionCount: parsedCoverageSources.ignoredCompletedAiSessions,
      exerciseResults: completedAiExerciseResults,
    });
    logInfo('api/session/generate', 'selected curriculum target', {
      userId,
      ...curriculumDiagnosticContext(coverageEvidence),
    });
    const parsedSessionHistory: SessionHistoryItem[] = priorSessions
      .map((session): SessionHistoryItem | null => {
        const parsedMeta = parseSessionMeta(session.summary);
        if (!parsedMeta) {
          return null;
        }
        const preferredHandoffNotes =
          parsedMeta.handoffNotes?.length && parsedMeta.handoffNotes.length > 0
            ? parsedMeta.handoffNotes
            : parsedMeta.nextSteps;
        return {
          date: session.createdAt,
          category: parsedMeta.category,
          topic: parsedMeta.topic,
          accuracy: parsedMeta.accuracy,
          strengths: parsedMeta.strengths,
          weaknesses: parsedMeta.weaknesses,
          nextSteps: parsedMeta.nextSteps,
          handoffNotes: preferredHandoffNotes,
          culturalNote: parsedMeta.culturalNote,
          miniLesson: parsedMeta.miniLesson,
          keyPhrases: parsedMeta.keyPhrases,
        };
      })
      .filter((item): item is SessionHistoryItem => item !== null);

    const sessionHistory: SessionHistoryItem[] = priorSessions
      .map((session): SessionHistoryItem | null => {
        const parsedMeta = parseSessionMeta(session.summary);
        if (parsedMeta) {
          const preferredHandoffNotes =
            parsedMeta.handoffNotes?.length && parsedMeta.handoffNotes.length > 0
              ? parsedMeta.handoffNotes
              : parsedMeta.nextSteps;
          return {
            date: session.createdAt,
            category: parsedMeta.category,
            topic: parsedMeta.topic,
            accuracy: parsedMeta.accuracy,
            strengths: parsedMeta.strengths,
            weaknesses: parsedMeta.weaknesses,
            nextSteps: parsedMeta.nextSteps,
            handoffNotes: preferredHandoffNotes,
            culturalNote: parsedMeta.culturalNote,
            miniLesson: parsedMeta.miniLesson,
            keyPhrases: parsedMeta.keyPhrases,
          };
        }
        if (session.summary && session.summary.trim()) {
          const legacy = legacySummaryToHistory(session.summary);
          return {
            ...legacy,
            date: session.createdAt,
          };
        }
        return null;
      })
      .filter((item): item is SessionHistoryItem => item !== null);

    const latestParsedHistory = parsedSessionHistory.slice(0, 5);
    const recentAccuracy = latestParsedHistory.length
      ? Math.round(
          latestParsedHistory.reduce((sum, item) => sum + item.accuracy, 0) /
            latestParsedHistory.length,
        )
      : undefined;
    const coveredTopics = Array.from(
      new Set(latestParsedHistory.map((item) => item.topic.trim()).filter(Boolean)),
    );
    stage = 'performance_loading';
    const exerciseResults = await getExerciseResultsForUser(userId);
    const totalResultCount = exerciseResults.length;
    const totalCorrectCount = exerciseResults.filter((item) => item.isCorrect).length;
    const overallAccuracy =
      totalResultCount > 0 ? Math.round((totalCorrectCount / totalResultCount) * 100) : 0;
    const byExercise = new Map<string, { total: number; correct: number }>();
    for (const row of exerciseResults) {
      const current = byExercise.get(row.exerciseId) ?? {
        total: 0,
        correct: 0,
      };
      current.total += 1;
      if (row.isCorrect) {
        current.correct += 1;
      }
      byExercise.set(row.exerciseId, current);
    }
    const weakExerciseIds: string[] = [];
    const strongExerciseIds: string[] = [];
    for (const [exerciseId, stats] of byExercise.entries()) {
      if (stats.total < 2) {
        continue;
      }
      const exerciseAccuracy = Math.round((stats.correct / stats.total) * 100);
      if (exerciseAccuracy < 50) {
        weakExerciseIds.push(exerciseId);
      }
      if (exerciseAccuracy >= 80) {
        strongExerciseIds.push(exerciseId);
      }
    }
    const recentWrongAnswers = exerciseResults
      .filter((item) => !item.isCorrect && item.answerText.trim())
      .slice(0, 5)
      .map((item) => item.answerText.trim());

    stage = 'generation_config';
    const generationTimeoutMs = resolveSessionGenerationTimeoutMs();
    let accepted: AcceptedGeneration | null = null;

    let lastError: unknown = new Error('Failed to generate AI teaching session.');
    let curriculumValidationFeedback: string[] = [];
    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
      generationAttempt = attempt;
      stage = 'generation';
      let rejectedUsage: FailedGenerationUsage | null = null;
      try {
        const generatedPlan = await generateSessionPlanWithTimeout(
          {
            userId: user.id,
            userName: user.name,
            userLevel: user.level,
            japaneseWritingEnabled: user.japaneseWritingEnabled,
            exerciseCount,
            sessionHistory,
            recentAccuracy,
            coveredTopics,
            totalSessionCount: coverageEvidence.source.totalCompletedAiSessions,
            coverageEvidence: coverageEvidence.promptSnapshot,
            learningJournal: user.progressJournal,
            curriculumValidationFeedback,
            performanceInsights: {
              overallAccuracy,
              weakExerciseIds,
              strongExerciseIds,
              recentWrongAnswers,
            },
          },
          generationTimeoutMs,
        );
        rejectedUsage = { model: generatedPlan.model, ...generatedPlan.tokenUsage };

        stage = 'curriculum_validation';
        const validation = validateGeneratedSessionPlan({
          plan: generatedPlan,
          coverageEvidence,
        });
        if (!validation.valid) {
          lastError = new Error('Generated session failed curriculum validation.');
          curriculumValidationFeedback = validationFeedbackForRetry(validation);
          logWarn('api/session/generate', 'curriculum validation failed', {
            attempt,
            maxAttempts: MAX_GENERATION_ATTEMPTS,
            stage,
            errorCode: 'curriculum_validation_failed',
            userId,
            ...curriculumDiagnosticContext(coverageEvidence),
            validationReasonCodes: validation.reasonCodes,
            generatedLearningObjectiveStatus: validation.details.generatedLearningObjectiveStatus,
            generatedCategory: isTopicCategoryKey(validation.details.generatedCategory)
              ? validation.details.generatedCategory
              : null,
            blockedCategories: validation.details.blockedCategories,
            preferredCategories: validation.details.preferredCategories,
            repeatedNonReviewKeyPhraseCount: validation.details.repeatedNonReviewKeyPhraseCount,
            intentionalReviewStatus: validation.details.intentionalReviewStatus,
          });
        } else {
          stage = 'planned_coverage';
          const plannedCoverage = buildPlannedSessionCoverage({
            lesson: generatedPlan.lesson,
            exercises: generatedPlan.exercises,
            learningObjectiveId: coverageEvidence.learningObjectiveSelection.objective.id,
          });
          logInfo('api/session/generate', 'curriculum plan approved', {
            attempt,
            validationReasonCodes: validation.reasonCodes,
            ...curriculumDiagnosticContext(coverageEvidence),
          });
          accepted = { plan: generatedPlan, plannedCoverage };
          break;
        }
      } catch (error) {
        lastError = error;
        if (stage === 'generation') {
          rejectedUsage = failedGenerationUsage(error);
        } else if (stage === 'planned_coverage') {
          curriculumValidationFeedback = [
            'Previous generation could not build required planned coverage metadata.',
            'Lesson culturalNote must be a nonblank string.',
            'Lesson keyPhrases must contain 3-5 key phrases.',
            'Every key phrase must have nonblank japanese, romaji, english, and usage strings.',
          ];
        }
        const timedOut = error instanceof SessionGenerationTimeoutError;
        logWarn('api/session/generate', 'generation attempt rejected', {
          attempt,
          maxAttempts: MAX_GENERATION_ATTEMPTS,
          stage,
          userId,
          errorCode: timedOut
            ? 'generation_timeout'
            : stage === 'planned_coverage'
              ? 'invalid_planned_coverage'
              : stage === 'curriculum_validation'
                ? 'curriculum_validation_failed'
                : rejectedUsage
                  ? 'invalid_generated_response'
                  : 'generation_failed',
          providerHttpStatus: stage === 'generation' ? providerHttpStatus(error) : null,
        });
        if (timedOut) {
          throw error;
        }
      }
      if (rejectedUsage) {
        const rejectedStage = stage;
        stage = 'rejected_usage_recording';
        await recordUsageEvent({
          userId,
          sessionId: null,
          model: rejectedUsage.model,
          tokensIn: rejectedUsage.input,
          tokensOut: rejectedUsage.output,
        });
        stage = rejectedStage;
      }
    }

    if (!accepted) {
      throw lastError;
    }

    const { plan, plannedCoverage } = accepted;
    stage = 'session_creation';
    const session = await createSessionRecord({
      userId,
      mode: 'ai',
      status: 'planned',
      model: plan.model,
      tokenInput: plan.tokenUsage.input,
      tokenOutput: plan.tokenUsage.output,
      plannedCoverage,
    });

    stage = 'exercise_attachment';
    await attachExercisesToSession(session.id, plan.exercises);
    stage = 'accepted_usage_recording';
    await recordUsageEvent({
      userId,
      sessionId: session.id,
      model: plan.model,
      tokensIn: plan.tokenUsage.input,
      tokensOut: plan.tokenUsage.output,
    });

    const response: GenerateResponse = {
      ok: true,
      state: 'active',
      session,
      lesson: plan.lesson,
      exercises: plan.exercises,
    };
    return json(response);
  } catch (error) {
    const timedOut = error instanceof SessionGenerationTimeoutError;
    logError('api/session/generate', 'failed', {
      stage,
      attempt: generationAttempt,
      errorCode: timedOut ? 'generation_timeout' : 'session_generation_failed',
      providerHttpStatus: stage === 'generation' ? providerHttpStatus(error) : null,
    });
    if (timedOut) {
      return jsonError('Session generation timed out. Please try again.', 503);
    }
    return jsonError('Failed to generate AI teaching session.', 500);
  }
};

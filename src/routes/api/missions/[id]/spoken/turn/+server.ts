import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import { loadSpokenMissionAttemptAccess } from '$lib/server/spoken-mission-access';
import {
  getSpokenMissionServerTurn,
  toSpokenMissionResult,
  type SpokenMissionDefinition,
} from '$lib/server/spoken-missions';
import {
  SpokenMissionProgressConflictError,
  recordSpokenMissionAssessment,
} from '$lib/server/spoken-missions-db';
import { checkBudget } from '$lib/server/token-limiter';
import {
  VoiceAssessmentError,
  assessMissionVoiceTurn,
  validateVoiceAudio,
} from '$lib/server/voice-assessment';
import type {
  SpokenMissionAttempt,
  SpokenMissionSkippedGoalEvent,
  SpokenMissionTurnEvidence,
  SpokenMissionTurnResponse,
} from '$lib/types';

function requiredFormString(form: FormData, name: string, maxLength = 160): string | null {
  const value = form.get(name);
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : null;
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

function audioValidationError(error: VoiceAssessmentError): Response {
  if (error.code === 'audio_too_large') {
    return jsonError('Audio file is too large. Please record a shorter answer.', 400, {
      recovery: 'record_again',
    });
  }
  return jsonError('Unsupported audio format. Please try recording again.', 400, {
    recovery: 'record_again',
  });
}

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return jsonError('Expected multipart/form-data.', 415);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('Invalid multipart/form-data.', 400);
  }

  const missionId = String(params.id ?? '').trim();
  const userId = requiredFormString(form, 'userId');
  const attemptId = requiredFormString(form, 'attemptId');
  const clientResponseId = requiredFormString(form, 'clientResponseId', 120);
  const turnNumber = Number(requiredFormString(form, 'turnNumber', 2));
  const englishSupportValue = requiredFormString(form, 'englishSupportRevealed', 5);
  const audio = form.get('audio');

  if (!missionId) return jsonError('Missing mission id.', 400);
  if (!userId || !attemptId || !clientResponseId || !Number.isInteger(turnNumber)) {
    return jsonError('Missing required fields.', 400);
  }
  if (englishSupportValue !== 'true' && englishSupportValue !== 'false') {
    return jsonError('Invalid englishSupportRevealed value.', 400);
  }

  const selectedUser = matchSelectedUser(cookies, userId);
  if (!selectedUser.ok) return jsonError(selectedUser.error, selectedUser.status);

  try {
    const access = await loadSpokenMissionAttemptAccess({
      userId: selectedUser.userId,
      missionId,
      attemptId,
    });
    if (!access.ok) return jsonError(access.error, access.status);
    const { attempt, definition, mission } = access;

    const duplicate = attempt.conversationLog.find(
      (entry): entry is SpokenMissionTurnEvidence =>
        !isSkippedGoalEvent(entry) && entry.clientResponseId === clientResponseId,
    );
    if (attempt.status === 'completed' || attempt.status === 'incomplete') {
      return duplicate
        ? json(serializeTurnResponse(definition, attempt, duplicate, true))
        : jsonError('Spoken Mission attempt is not in progress.', 400);
    }
    if (attempt.status !== 'in_progress') {
      return jsonError('Spoken Mission attempt is not in progress.', 400);
    }
    if (duplicate) {
      return json(serializeTurnResponse(definition, attempt, duplicate, true));
    }
    if (turnNumber < 1 || turnNumber > 3 || attempt.currentTurn !== turnNumber) {
      return jsonError('Turn does not match current attempt progress.', 409);
    }
    if (!isAudioFile(audio)) return jsonError('Missing audio file.', 400);

    try {
      validateVoiceAudio(audio);
    } catch (error) {
      if (error instanceof VoiceAssessmentError) return audioValidationError(error);
      throw error;
    }

    const budget = await checkBudget(selectedUser.userId);
    if (!budget.allowed) {
      return jsonError('Daily AI budget exhausted. Your attempt is saved.', 429, {
        recovery: 'retry_upload',
      });
    }

    const goal = definition.goals[turnNumber - 1];
    if (!goal) return jsonError('Turn is not configured.', 400);
    const serverTurn = getSpokenMissionServerTurn(definition, attempt.wordingVariant, turnNumber);
    const assessment = await assessMissionVoiceTurn({
      userId: selectedUser.userId,
      audio,
      goal: goal.learnerGoal,
      alternatives: goal.alternatives,
      rubric: goal.rubric,
    });
    const evidence: SpokenMissionTurnEvidence = {
      goalKey: goal.key,
      turnNumber,
      npcJapanese: serverTurn.npcDialogue.japanese,
      npcRomaji: serverTurn.npcDialogue.romaji,
      transcript: assessment.transcript ?? null,
      outcome: assessment.outcome,
      confidence: assessment.outcome === 'could_not_assess' ? null : assessment.confidence,
      feedback:
        assessment.feedback ??
        (assessment.outcome === 'accepted'
          ? 'You accomplished this goal.'
          : 'Try the same goal again.'),
      supportUsed: attempt.currentTurnSupportUsed || englishSupportValue === 'true',
      clientResponseId,
      assessedAt: new Date().toISOString(),
    };

    const recorded = await recordSpokenMissionAssessment({
      attemptId,
      userId: selectedUser.userId,
      missionId: mission.id,
      definitionVersion: definition.version,
      turnNumber,
      evidence,
    });
    return json(
      serializeTurnResponse(
        definition,
        recorded.attempt,
        recorded.evidence,
        recorded.status === 'duplicate',
      ),
    );
  } catch (error) {
    if (error instanceof SpokenMissionProgressConflictError) {
      return jsonError('Spoken Mission progress changed. Reload and try again.', 409);
    }
    console.error('[api/missions/[id]/spoken/turn] failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      missionId,
      attemptId,
      turnNumber,
    });
    return jsonError('Failed to assess Spoken Mission response. Your attempt is saved.', 500, {
      recovery: 'retry_upload',
    });
  }
};

function serializeTurnResponse(
  definition: SpokenMissionDefinition,
  attempt: SpokenMissionAttempt,
  evidence: SpokenMissionTurnEvidence,
  duplicate: boolean,
): SpokenMissionTurnResponse {
  const terminal = attempt.status === 'completed' || attempt.status === 'incomplete';
  const advanced = evidence.outcome === 'accepted';
  const goal = definition.goals[evidence.turnNumber - 1];
  return {
    duplicate,
    assessment: {
      outcome: evidence.outcome,
      transcript: evidence.transcript,
      confidence: evidence.confidence,
      feedback: evidence.feedback,
      retrySuggestion: evidence.outcome === 'retry' ? (goal?.retrySuggestion ?? null) : null,
    },
    nextTurn:
      !terminal && advanced
        ? getSpokenMissionServerTurn(definition, attempt.wordingVariant, attempt.currentTurn)
        : null,
    isComplete: terminal,
    result: toSpokenMissionResult(definition, attempt),
  };
}

function isSkippedGoalEvent(
  entry: SpokenMissionAttempt['conversationLog'][number],
): entry is SpokenMissionSkippedGoalEvent {
  return 'kind' in entry && entry.kind === 'skipped';
}

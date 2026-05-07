import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import { getMissionById, getUserMission, updateUserMission } from '$lib/server/missions-db';
import {
  evaluateUserResponse,
  generateMissionTurn,
  recordMissionTokenUsage,
} from '$lib/server/missions-ai';
import type { MissionRespondResponse, MissionTurn } from '$lib/types';

type RespondMissionRequest = {
  userId?: string;
  userMissionId?: string;
  response?: string;
  turnNumber?: number;
  selectedChoiceIndex?: number;
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as RespondMissionRequest;
    const missionId = String(params.id ?? '').trim();
    const userIdResult = requireStringField(body, 'userId');
    const userMissionIdResult = requireStringField(body, 'userMissionId');
    const turnNumber = Number(body?.turnNumber);

    if (!missionId) {
      return jsonError('Missing mission id.', 400);
    }

    if (
      !userIdResult.ok ||
      !userMissionIdResult.ok ||
      !Number.isInteger(turnNumber) ||
      turnNumber < 1
    ) {
      return jsonError('Missing required fields.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const userMissionId = userMissionIdResult.value;
    const responseText = String(body.response ?? '');
    const selectedChoiceIndex = body.selectedChoiceIndex;

    const userMission = await getUserMission(userMissionId);
    if (!userMission) {
      return jsonError('User mission not found.', 404);
    }

    if (userMission.userId !== userId) {
      return jsonError('Forbidden.', 403);
    }

    if (userMission.status !== 'in_progress') {
      return jsonError('Mission is not in progress.', 400);
    }

    const mission = await getMissionById(missionId);
    if (!mission) {
      return jsonError('Mission not found.', 404);
    }

    if (mission.id !== userMission.missionId) {
      return jsonError('Mission mismatch for user mission.', 400);
    }

    const conversationLog: MissionTurn[] = [...userMission.conversationLog];
    const turnIndex = conversationLog.findIndex((turn) => turn.turnNumber === turnNumber);
    if (turnIndex < 0) {
      return jsonError('Turn not found in conversation log.', 400);
    }

    const currentTurn = conversationLog[turnIndex];
    if (currentTurn.userResponse) {
      return jsonError('Turn has already been answered.', 400);
    }

    const mode = userMission.mode;
    let feedback: { correct: boolean; message: string };
    let chosenJapaneseText: string | null = null;

    if (typeof selectedChoiceIndex === 'number' || mode === 'practice') {
      const choices = currentTurn.choices ?? [];
      if (!Array.isArray(choices) || choices.length === 0) {
        return jsonError('No choices available for this turn.', 400);
      }

      if (typeof selectedChoiceIndex !== 'number' || !Number.isInteger(selectedChoiceIndex)) {
        return jsonError('selectedChoiceIndex is required in practice mode.', 400);
      }

      const selectedIndex: number = selectedChoiceIndex;

      if (selectedIndex < 0 || selectedIndex >= choices.length) {
        return jsonError('selectedChoiceIndex out of range.', 400);
      }

      const selectedChoice = choices[selectedIndex];
      const correct = selectedChoice.isCorrect;
      feedback = {
        correct,
        message: correct ? 'Good!' : 'Not quite — try the other option',
      };
      chosenJapaneseText = selectedChoice.japanese;
    } else {
      const trimmedResponse = responseText.trim();
      if (!trimmedResponse) {
        return jsonError('Response text is required in immersion mode.', 400);
      }

      const evaluation = await evaluateUserResponse({
        mission,
        mode: 'immersion',
        turnNumber,
        npcDialogue: currentTurn.npcDialogue,
        userResponse: trimmedResponse,
        expectedContext: mission.title,
        conversationHistory: userMission.conversationLog,
      });

      await recordMissionTokenUsage(userId, evaluation.tokenUsage);
      feedback = {
        correct: evaluation.correct,
        message: evaluation.message,
      };
    }

    const trimmedResponse = responseText.trim();
    const japaneseResponse =
      mode === 'practice' && !trimmedResponse ? (chosenJapaneseText ?? '') : trimmedResponse;

    conversationLog[turnIndex] = {
      ...currentTurn,
      userResponse: {
        japanese: japaneseResponse,
        romaji: undefined,
      },
      feedback,
    };

    const isLastTurn = turnNumber >= config.missions.maxTurnsPerMission;

    let nextTurn: MissionTurn | null = null;
    if (!isLastTurn) {
      const generated = await generateMissionTurn({
        mission,
        mode,
        turnNumber: turnNumber + 1,
        totalTurns: config.missions.maxTurnsPerMission,
        conversationHistory: [...conversationLog],
        userLevel: undefined,
      });

      await recordMissionTokenUsage(userId, generated.tokenUsage);
      nextTurn = generated.turn;
      conversationLog.push(nextTurn);
    }

    const correctResponses = userMission.correctResponses + (feedback.correct ? 1 : 0);

    await updateUserMission(userMissionId, {
      conversationLog,
      exchanges: turnNumber,
      correctResponses,
    });

    const result: MissionRespondResponse = {
      feedback,
      nextTurn,
      isComplete: isLastTurn,
    };

    return json(result);
  } catch (error) {
    console.error('[api/missions/[id]/respond] failed', {
      error,
      missionId: params.id,
    });
    return jsonError('Failed to process mission response.', 500);
  }
};

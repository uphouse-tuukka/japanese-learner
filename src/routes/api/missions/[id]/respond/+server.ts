import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$lib/server/config';
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

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const body = (await request.json()) as RespondMissionRequest;
    const missionId = String(params.id ?? '').trim();
    const userId = String(body.userId ?? '').trim();
    const userMissionId = String(body.userMissionId ?? '').trim();
    const responseText = String(body.response ?? '');
    const turnNumber = Number(body.turnNumber);
    const selectedChoiceIndex = body.selectedChoiceIndex;

    if (!missionId) {
      return json({ error: 'Missing mission id.' }, { status: 400 });
    }

    if (!userId || !userMissionId || !Number.isInteger(turnNumber) || turnNumber < 1) {
      return json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const userMission = await getUserMission(userMissionId);
    if (!userMission) {
      return json({ error: 'User mission not found.' }, { status: 404 });
    }

    if (userMission.userId !== userId) {
      return json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (userMission.status !== 'in_progress') {
      return json({ error: 'Mission is not in progress.' }, { status: 400 });
    }

    const mission = await getMissionById(missionId);
    if (!mission) {
      return json({ error: 'Mission not found.' }, { status: 404 });
    }

    if (mission.id !== userMission.missionId) {
      return json({ error: 'Mission mismatch for user mission.' }, { status: 400 });
    }

    const conversationLog: MissionTurn[] = [...userMission.conversationLog];
    const turnIndex = conversationLog.findIndex((turn) => turn.turnNumber === turnNumber);
    if (turnIndex < 0) {
      return json({ error: 'Turn not found in conversation log.' }, { status: 400 });
    }

    const currentTurn = conversationLog[turnIndex];
    if (currentTurn.userResponse) {
      return json({ error: 'Turn has already been answered.' }, { status: 400 });
    }

    const mode = userMission.mode;
    let feedback: { correct: boolean; message: string };
    let chosenJapaneseText: string | null = null;

    if (typeof selectedChoiceIndex === 'number' || mode === 'practice') {
      const choices = currentTurn.choices ?? [];
      if (!Array.isArray(choices) || choices.length === 0) {
        return json({ error: 'No choices available for this turn.' }, { status: 400 });
      }

      if (typeof selectedChoiceIndex !== 'number' || !Number.isInteger(selectedChoiceIndex)) {
        return json(
          { error: 'selectedChoiceIndex is required in practice mode.' },
          { status: 400 },
        );
      }

      const selectedIndex: number = selectedChoiceIndex;

      if (selectedIndex < 0 || selectedIndex >= choices.length) {
        return json({ error: 'selectedChoiceIndex out of range.' }, { status: 400 });
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
        return json({ error: 'Response text is required in immersion mode.' }, { status: 400 });
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
        conversationHistory: conversationLog,
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
    return json({ error: 'Failed to process mission response.' }, { status: 500 });
  }
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import {
  createUserMission,
  getCategorySessionCount,
  getMissionById,
  updateUserMission,
} from '$lib/server/missions-db';
import { generateMissionTurn, recordMissionTokenUsage } from '$lib/server/missions-ai';
import { config } from '$lib/server/config';
import { checkBudget } from '$lib/server/token-limiter';
import { getUser } from '$lib/server/users';
import type { MissionMode, MissionStartResponse } from '$lib/types';

type StartMissionRequest = {
  userId?: string;
  mode?: MissionMode;
};

export const POST: RequestHandler = async ({ params, request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as StartMissionRequest;
    const missionId = String(params.id ?? '').trim();
    const userIdResult = requireStringField(body, 'userId');

    if (!missionId) {
      return jsonError('Missing mission id.', 400);
    }

    if (!userIdResult.ok) {
      return jsonError(userIdResult.error, 400);
    }

    const mode = body.mode;
    if (mode !== 'practice' && mode !== 'immersion') {
      return jsonError('Invalid mode. Must be practice or immersion.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;

    const mission = await getMissionById(missionId);
    if (!mission) {
      return jsonError('Mission not found.', 404);
    }

    const user = await getUser(userId);
    if (!user) {
      return jsonError('User not found.', 404);
    }

    if (!config.missions.unlockAllOverride) {
      const budget = await checkBudget(userId);
      if (!budget.allowed) {
        return jsonError(
          "You've reached today's AI practice budget. Please try again tomorrow.",
          429,
        );
      }
    }

    const categorySessionCount = await getCategorySessionCount(userId, mission.category);
    const unlocked =
      mission.startUnlocked ||
      config.missions.unlockAllOverride ||
      categorySessionCount >= mission.unlockSessionsRequired;

    if (!unlocked) {
      return jsonError('Mission is locked.', 403);
    }

    const userMissionId = await createUserMission({ userId, missionId: mission.id, mode });

    const generated = await generateMissionTurn({
      mission,
      mode,
      turnNumber: 1,
      totalTurns: config.missions.maxTurnsPerMission,
      conversationHistory: [],
      userLevel: undefined,
    });

    await recordMissionTokenUsage(userId, generated.tokenUsage);
    await updateUserMission(userMissionId, { conversationLog: [generated.turn] });

    const response: MissionStartResponse = {
      userMissionId,
      turn: generated.turn,
      sceneDescription: generated.sceneDescription ?? '',
      characterName: generated.characterName,
      characterEmoji: generated.characterEmoji,
      totalTurns: config.missions.maxTurnsPerMission,
    };

    return json(response);
  } catch (error) {
    console.error('[api/missions/[id]/start] failed', {
      error,
      missionId: params.id,
    });
    return jsonError('Failed to start mission.', 500);
  }
};

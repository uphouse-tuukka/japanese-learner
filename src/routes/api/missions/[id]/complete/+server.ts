import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { jsonError, readJsonBody, requireStringField } from '$lib/server/api';
import { matchSelectedUser } from '$lib/server/selected-user';
import type { MissionCompleteResponse } from '$lib/types';
import {
  awardBadge,
  getMissionById,
  getUserMission,
  hasCompletedMissionInMode,
  updateUserMission,
} from '$lib/server/missions-db';
import { processMissionCompletion } from '$lib/server/gamification';

type CompleteMissionRequest = {
  userId?: string;
  userMissionId?: string;
  naturalPhrasings?: number;
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const bodyResult = await readJsonBody(request);
    if (!bodyResult.ok) {
      return jsonError(bodyResult.error, 400);
    }

    const body = bodyResult.value as CompleteMissionRequest;
    const userIdResult = requireStringField(body, 'userId');
    const userMissionIdResult = requireStringField(body, 'userMissionId');

    if (!userIdResult.ok || !userMissionIdResult.ok) {
      return jsonError('Missing userId or userMissionId.', 400);
    }

    const selectedUser = matchSelectedUser(cookies, userIdResult.value);
    if (!selectedUser.ok) {
      return jsonError(selectedUser.error, selectedUser.status);
    }

    const userId = selectedUser.userId;
    const userMissionId = userMissionIdResult.value;
    const naturalPhrasings = Math.max(0, Math.floor(Number(body.naturalPhrasings ?? 0)));

    const userMission = await getUserMission(userMissionId);
    if (!userMission) {
      return jsonError('Mission progress not found.', 404);
    }

    if (userMission.userId !== userId) {
      return jsonError('Forbidden.', 403);
    }

    if (userMission.status !== 'in_progress') {
      return jsonError('Mission is not in progress.', 400);
    }

    const exchanges = userMission.exchanges;
    const correctResponses = userMission.correctResponses;
    const score = exchanges > 0 ? Math.round((correctResponses / exchanges) * 100) : 0;
    const passed = score >= 80;

    const completion = await processMissionCompletion(userId, userMission.missionId, {
      mode: userMission.mode,
      correctResponses,
      totalExchanges: exchanges,
      naturalPhrasings,
    });

    let earnedBadge = null;
    let badgeAlreadyEarned = false;

    if (userMission.mode === 'immersion' && passed) {
      badgeAlreadyEarned = await hasCompletedMissionInMode(
        userId,
        userMission.missionId,
        'immersion',
      );
      if (!badgeAlreadyEarned) {
        const mission = await getMissionById(userMission.missionId);
        if (!mission) {
          return jsonError('Mission not found.', 404);
        }

        earnedBadge = await awardBadge({
          userId,
          missionId: mission.id,
          badgeEmoji: mission.badgeEmoji,
          badgeName: mission.badgeName,
          badgeStatement: mission.badgeStatement,
        });
      }
    }

    await updateUserMission(userMission.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      score,
      xpEarned: completion.xpBreakdown.total,
      badgeEarned: earnedBadge !== null,
    });

    const response: MissionCompleteResponse = {
      exchanges,
      correctResponses,
      score,
      passed,
      xpBreakdown: completion.xpBreakdown,
      badgeEarned: earnedBadge,
      confidenceStatement: earnedBadge?.badgeStatement ?? null,
    };

    return json(response);
  } catch (error) {
    console.error('[api/missions/[id]/complete] failed', { error });
    return jsonError('Failed to complete mission.', 500);
  }
};

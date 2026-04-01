import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = (await request.json()) as CompleteMissionRequest;
    const userId = String(body.userId ?? '').trim();
    const userMissionId = String(body.userMissionId ?? '').trim();
    const naturalPhrasings = Math.max(0, Math.floor(Number(body.naturalPhrasings ?? 0)));

    if (!userId || !userMissionId) {
      return json({ ok: false, error: 'Missing userId or userMissionId.' }, { status: 400 });
    }

    const userMission = await getUserMission(userMissionId);
    if (!userMission) {
      return json({ ok: false, error: 'Mission progress not found.' }, { status: 404 });
    }

    if (userMission.userId !== userId) {
      return json({ ok: false, error: 'Forbidden.' }, { status: 403 });
    }

    if (userMission.status !== 'in_progress') {
      return json({ ok: false, error: 'Mission is not in progress.' }, { status: 400 });
    }

    const exchanges = userMission.exchanges;
    const correctResponses = userMission.correctResponses;
    const score = exchanges > 0 ? Math.round((correctResponses / exchanges) * 100) : 0;

    const completion = await processMissionCompletion(userId, userMission.missionId, {
      mode: userMission.mode,
      correctResponses,
      totalExchanges: exchanges,
      naturalPhrasings,
    });

    let earnedBadge = null;
    let badgeAlreadyEarned = false;

    if (userMission.mode === 'immersion') {
      badgeAlreadyEarned = await hasCompletedMissionInMode(
        userId,
        userMission.missionId,
        'immersion',
      );
      if (!badgeAlreadyEarned) {
        const mission = await getMissionById(userMission.missionId);
        if (!mission) {
          return json({ ok: false, error: 'Mission not found.' }, { status: 404 });
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
      xpBreakdown: completion.xpBreakdown,
      badgeEarned: earnedBadge,
      confidenceStatement: earnedBadge?.badgeStatement ?? null,
    };

    return json(response);
  } catch (error) {
    console.error('[api/missions/[id]/complete] failed', { error });
    return json({ ok: false, error: 'Failed to complete mission.' }, { status: 500 });
  }
};

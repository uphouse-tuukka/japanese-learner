import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
  createUserMission,
  getCategorySessionCount,
  getMissionById,
  updateUserMission,
} from '$lib/server/missions-db';
import { generateMissionTurn, recordMissionTokenUsage } from '$lib/server/missions-ai';
import { config } from '$lib/server/config';
import { checkBudget } from '$lib/server/token-limiter';
import type { MissionMode, MissionStartResponse } from '$lib/types';

type StartMissionRequest = {
  userId?: string;
  mode?: MissionMode;
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const body = (await request.json()) as StartMissionRequest;
    const missionId = String(params.id ?? '').trim();
    const userId = String(body.userId ?? '').trim();
    const mode = body.mode;

    if (!missionId) {
      return json({ error: 'Missing mission id.' }, { status: 400 });
    }

    if (!userId) {
      return json({ error: 'Missing userId.' }, { status: 400 });
    }

    if (mode !== 'practice' && mode !== 'immersion') {
      return json({ error: 'Invalid mode. Must be practice or immersion.' }, { status: 400 });
    }

    const mission = await getMissionById(missionId);
    if (!mission) {
      return json({ error: 'Mission not found.' }, { status: 404 });
    }

    if (!config.missions.unlockAllOverride) {
      const budget = await checkBudget(userId);
      if (!budget.allowed) {
        return json(
          {
            error: "You've reached today's AI practice budget. Please try again tomorrow.",
          },
          { status: 429 },
        );
      }
    }

    const categorySessionCount = await getCategorySessionCount(userId, mission.category);
    const unlocked =
      mission.startUnlocked ||
      config.missions.unlockAllOverride ||
      categorySessionCount >= mission.unlockSessionsRequired;

    if (!unlocked) {
      return json({ error: 'Mission is locked.' }, { status: 403 });
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

    await recordMissionTokenUsage(userId, mission.id, generated.tokenUsage);
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
    return json({ error: 'Failed to start mission.' }, { status: 500 });
  }
};

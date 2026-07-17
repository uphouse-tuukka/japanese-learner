import type {
  SpokenMissionAttempt,
  SpokenMissionBriefing,
  SpokenMissionGoalKey,
  SpokenMissionHistoryEntry,
  SpokenMissionResult,
  SpokenMissionServerTurn,
  SpokenMissionSkippedGoalEvent,
  SpokenMissionSupportPolicy,
  SpokenMissionTurnEvidence,
} from '$lib/types';

export type SpokenMissionServerLine = {
  japanese: string;
  romaji: string;
  english: string;
};

export type SpokenMissionGoal = {
  key: SpokenMissionGoalKey;
  title: string;
  learnerGoal: string;
  serverLines: SpokenMissionServerLine[];
  alternatives: string[];
  rubric: string;
  retrySuggestion: {
    japanese: string;
    romaji: string;
  };
};

export type SpokenMissionDefinition = {
  missionId: string;
  version: string;
  supersededVersions: readonly string[];
  canDo: string;
  briefing: {
    situation: string;
    assessment: string;
    evidence: string;
    privacy: string;
  };
  approximateMinutes: number;
  maxRecordingSeconds: number;
  goals: [SpokenMissionGoal, SpokenMissionGoal, SpokenMissionGoal];
  suggestedPhrase: {
    japanese: string;
    romaji: string;
    english: string;
  };
};

const ORDER_AT_A_RESTAURANT: SpokenMissionDefinition = {
  missionId: 'mission-order-restaurant',
  version: 'restaurant-order-v3',
  supersededVersions: ['restaurant-order-v1', 'restaurant-order-v2'],
  canDo: 'I can manage a short order conversation in a restaurant.',
  briefing: {
    situation:
      'You are ordering at a busy ramen restaurant. Listen and respond as the conversation unfolds.',
    assessment:
      'Your communicative intent is assessed, not your pronunciation or accent. Natural wording and small particle or formality differences are welcome.',
    evidence:
      'Complete all three goals without English listening support for Independent evidence. If you reveal English listening support on any turn, completion records Supported evidence.',
    privacy:
      'Each recording is sent for transcription and semantic assessment. Transcripts and semantic assessments are retained for evidence and resume. Raw audio is discarded after assessment and never saved.',
  },
  approximateMinutes: 2,
  maxRecordingSeconds: 12,
  goals: [
    {
      key: 'order',
      title: 'Order',
      learnerGoal: 'Order one ramen.',
      serverLines: [
        {
          japanese: 'ご注文はお決まりですか。',
          romaji: 'go-chuumon wa okimari desu ka.',
          english: 'Are you ready to order?',
        },
        {
          japanese: '何になさいますか。',
          romaji: 'nani ni nasaimasu ka.',
          english: 'What would you like?',
        },
      ],
      alternatives: ['ラーメンを一つお願いします。', 'ラーメンをください。', 'ラーメン一つ。'],
      rubric:
        'Accept any clear request for one ramen. The exact counter, particle, and politeness level may vary. Reject a different item, no order, or unrelated intent.',
      retrySuggestion: {
        japanese: 'ラーメンを一つお願いします。',
        romaji: 'raamen o hitotsu onegaishimasu.',
      },
    },
    {
      key: 'respond',
      title: 'Respond',
      learnerGoal: 'Answer that water is enough when asked about a drink.',
      serverLines: [
        {
          japanese: 'お飲み物はいかがですか。',
          romaji: 'o-nomimono wa ikaga desu ka.',
          english: 'Would you like something to drink?',
        },
        {
          japanese: 'お飲み物もご注文になりますか。',
          romaji: 'o-nomimono mo go-chuumon ni narimasu ka.',
          english: 'Would you also like to order a drink?',
        },
      ],
      alternatives: ['お水でお願いします。', '水で大丈夫です。', 'お水だけでいいです。'],
      rubric:
        'Accept a clear response that water is sufficient. Minor wording and formality differences are acceptable. Reject ordering an unrelated drink or failing to answer the question.',
      retrySuggestion: {
        japanese: 'お水でお願いします。',
        romaji: 'o-mizu de onegaishimasu.',
      },
    },
    {
      key: 'repair',
      title: 'Repair',
      learnerGoal: 'Correct the server and clarify that the order is one regular ramen.',
      serverLines: [
        {
          japanese: 'チャーシュー麺を二つですね。',
          romaji: 'chaashuumen o futatsu desu ne.',
          english: 'That is two chashu ramen, correct?',
        },
        {
          japanese: 'みそラーメンを二つでよろしいですか。',
          romaji: 'miso raamen o futatsu de yoroshii desu ka.',
          english: 'Is two miso ramen correct?',
        },
      ],
      alternatives: [
        'いいえ、普通のラーメンを一つお願いします。',
        'すみません、ラーメン一つです。',
        '違います。ラーメンを一つください。',
      ],
      rubric:
        'Accept any clear correction from the wrong item or quantity to one regular ramen. A polite repair phrase is helpful but not required. Reject confirming the mistaken order or giving unrelated intent.',
      retrySuggestion: {
        japanese: 'いいえ、普通のラーメンを一つお願いします。',
        romaji: 'iie, futsuu no raamen o hitotsu onegaishimasu.',
      },
    },
  ],
  suggestedPhrase: {
    japanese: 'すみません、ラーメンは一つです。',
    romaji: 'sumimasen, raamen wa hitotsu desu.',
    english: 'Sorry, it is one ramen.',
  },
};

const SPOKEN_MISSIONS = new Map<string, SpokenMissionDefinition>([
  [ORDER_AT_A_RESTAURANT.missionId, ORDER_AT_A_RESTAURANT],
]);

export const SPOKEN_MISSION_SUPPORT_POLICY: SpokenMissionSupportPolicy = {
  englishListeningSupport: 'optional',
  evidenceWithoutEnglishSupport: 'independent',
  evidenceWithEnglishSupport: 'supported',
};

export function listSpokenMissionIds(): string[] {
  return [...SPOKEN_MISSIONS.keys()];
}

export function getSpokenMissionDefinition(missionId: string): SpokenMissionDefinition | null {
  return SPOKEN_MISSIONS.get(missionId) ?? null;
}

export function selectSpokenMissionVariant(
  definition: SpokenMissionDefinition,
  previousVariant: number | null,
  random: () => number = Math.random,
): number {
  const variantCount = Math.min(...definition.goals.map((goal) => goal.serverLines.length));
  if (variantCount <= 1) return 0;

  const candidates = Array.from({ length: variantCount }, (_, index) => index).filter(
    (index) => index !== previousVariant,
  );
  const selectedIndex = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[Math.max(0, selectedIndex)] ?? 0;
}

export function toSpokenMissionBriefing(
  definition: SpokenMissionDefinition,
): SpokenMissionBriefing {
  return {
    canDo: definition.canDo,
    situation: definition.briefing.situation,
    assessment: definition.briefing.assessment,
    evidence: definition.briefing.evidence,
    privacy: definition.briefing.privacy,
    approximateMinutes: definition.approximateMinutes,
    maxRecordingSeconds: definition.maxRecordingSeconds,
    goals: definition.goals.map(({ key, title }) => ({ key, title })),
  };
}

export function getSpokenMissionServerTurn(
  definition: SpokenMissionDefinition,
  wordingVariant: number,
  turnNumber: number,
): SpokenMissionServerTurn {
  const { goal, line } = getSpokenMissionServerLine(definition, wordingVariant, turnNumber);
  return {
    turnNumber,
    goalKey: goal.key,
    goalTitle: goal.title,
    npcDialogue: {
      japanese: line.japanese,
      romaji: line.romaji,
    },
  };
}

export function getSpokenMissionEnglishSupport(
  definition: SpokenMissionDefinition,
  wordingVariant: number,
  turnNumber: number,
): string {
  return getSpokenMissionServerLine(definition, wordingVariant, turnNumber).line.english;
}

function getSpokenMissionServerLine(
  definition: SpokenMissionDefinition,
  wordingVariant: number,
  turnNumber: number,
): { goal: SpokenMissionGoal; line: SpokenMissionServerLine } {
  const goal = definition.goals[turnNumber - 1];
  if (!goal) throw new Error(`[spoken-missions] invalid turn number: ${turnNumber}`);
  const line = goal.serverLines[wordingVariant] ?? goal.serverLines[0];
  if (!line) throw new Error(`[spoken-missions] missing server line for turn: ${turnNumber}`);
  return { goal, line };
}

export function toSpokenMissionHistory(
  definition: SpokenMissionDefinition,
  attempt: SpokenMissionAttempt,
): SpokenMissionHistoryEntry[] {
  return attempt.conversationLog.map((entry) => {
    const goal = definition.goals.find((candidate) => candidate.key === entry.goalKey);
    if (!goal) {
      throw new Error(`[spoken-missions] saved attempt has unknown goal: ${entry.goalKey}`);
    }

    if (isSkippedGoalEvent(entry)) {
      return {
        kind: 'skipped',
        goalKey: entry.goalKey,
        goalTitle: goal.title,
        turnNumber: entry.turnNumber,
        npcDialogue: {
          japanese: entry.npcJapanese,
          romaji: entry.npcRomaji,
        },
        supportUsed: entry.supportUsed,
        writtenSupportRevealed: entry.writtenSupportRevealed,
        skippedAt: entry.skippedAt,
      };
    }

    return {
      kind: 'assessment',
      goalKey: entry.goalKey,
      goalTitle: goal.title,
      turnNumber: entry.turnNumber,
      npcDialogue: {
        japanese: entry.npcJapanese,
        romaji: entry.npcRomaji,
      },
      assessment: {
        transcript: entry.transcript,
        outcome: entry.outcome,
        confidence: entry.confidence,
        feedback: entry.feedback,
      },
      supportUsed: entry.supportUsed,
      writtenSupportRevealed: entry.writtenSupportRevealed === true,
      assessedAt: entry.assessedAt,
    };
  });
}

export function toSpokenMissionResult(
  definition: SpokenMissionDefinition,
  attempt: SpokenMissionAttempt,
): SpokenMissionResult | null {
  if (attempt.status === 'incomplete') {
    const goals = definition.goals.map((goal) => {
      const skipped = attempt.conversationLog.some(
        (entry) => isSkippedGoalEvent(entry) && entry.goalKey === goal.key,
      );
      const accepted = attempt.conversationLog.some(
        (entry) =>
          !isSkippedGoalEvent(entry) && entry.goalKey === goal.key && entry.outcome === 'accepted',
      );
      if (!skipped && !accepted) {
        throw new Error(`[spoken-missions] incomplete attempt has no result for ${goal.key}`);
      }
      return {
        goalKey: goal.key,
        title: goal.title,
        status: skipped ? ('skipped' as const) : ('accepted' as const),
      };
    });
    return { kind: 'incomplete', canDo: definition.canDo, goals };
  }
  if (attempt.status !== 'completed' || !attempt.evidenceState) return null;

  const goals = definition.goals.map((goal) => {
    const accepted = attempt.conversationLog.find(
      (entry): entry is SpokenMissionTurnEvidence =>
        !isSkippedGoalEvent(entry) && entry.goalKey === goal.key && entry.outcome === 'accepted',
    );
    if (!accepted) {
      throw new Error(`[spoken-missions] completed attempt is missing ${goal.key} evidence`);
    }
    return { ...accepted, title: goal.title };
  });

  return {
    kind: 'evidence',
    evidenceState: attempt.evidenceState,
    canDo: definition.canDo,
    goals,
    suggestedPhrase: definition.suggestedPhrase,
  };
}

function isSkippedGoalEvent(
  entry: SpokenMissionAttempt['conversationLog'][number],
): entry is SpokenMissionSkippedGoalEvent {
  return 'kind' in entry && entry.kind === 'skipped';
}

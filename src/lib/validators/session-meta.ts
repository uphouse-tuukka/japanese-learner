import type { SessionMeta, SessionMiniLesson } from '$lib/types';
import { asStringArray, parseJsonObject } from './common';

function parseMiniLesson(value: unknown): SessionMiniLesson | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Partial<SessionMiniLesson>;
  if (
    (raw.kind !== 'related_phrase' &&
      raw.kind !== 'likely_reply' &&
      raw.kind !== 'nuance_upgrade' &&
      raw.kind !== 'follow_up') ||
    typeof raw.japanese !== 'string' ||
    typeof raw.romaji !== 'string' ||
    typeof raw.english !== 'string' ||
    typeof raw.note !== 'string'
  ) {
    return undefined;
  }

  return {
    kind: raw.kind,
    japanese: raw.japanese,
    romaji: raw.romaji,
    english: raw.english,
    note: raw.note,
  };
}

export function parseSessionMeta(value: string | null | undefined): SessionMeta | null {
  if (!value) {
    return null;
  }

  const parsed = parseJsonObject(value) as Partial<SessionMeta> | null;
  if (!parsed) {
    return null;
  }

  if (
    typeof parsed.summaryText !== 'string' ||
    typeof parsed.topic !== 'string' ||
    typeof parsed.accuracy !== 'number' ||
    !Array.isArray(parsed.strengths) ||
    !Array.isArray(parsed.weaknesses) ||
    !Array.isArray(parsed.exerciseTypes) ||
    !Array.isArray(parsed.keyPhrases)
  ) {
    return null;
  }

  const nextSteps = asStringArray(parsed.nextSteps);
  const handoffNotes = asStringArray(parsed.handoffNotes);
  const miniLesson = parseMiniLesson(parsed.miniLesson);

  return {
    summaryText: parsed.summaryText,
    category: typeof parsed.category === 'string' ? parsed.category : undefined,
    topic: parsed.topic,
    accuracy: parsed.accuracy,
    strengths: asStringArray(parsed.strengths),
    weaknesses: asStringArray(parsed.weaknesses),
    nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    handoffNotes: handoffNotes.length > 0 ? handoffNotes : undefined,
    exerciseTypes: asStringArray(parsed.exerciseTypes),
    keyPhrases: asStringArray(parsed.keyPhrases),
    culturalNote: typeof parsed.culturalNote === 'string' ? parsed.culturalNote : undefined,
    miniLesson,
    hadLevelUpRecommendation:
      typeof parsed.hadLevelUpRecommendation === 'boolean'
        ? parsed.hadLevelUpRecommendation
        : undefined,
  };
}

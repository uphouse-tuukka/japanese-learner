import {
  LEVEL_ORDER,
  type LevelUpRecommendation,
  type SessionKeyPhraseDetail,
  type SessionMeta,
  type SessionMiniLesson,
  type SessionReviewIntent,
} from '$lib/types';
import { asStringArray, parseJsonObject } from './common';

const MAX_KEY_PHRASE_DETAILS = 10;
const MAX_KEY_PHRASE_DETAIL_INPUT_ITEMS = 50;
const MAX_KEY_PHRASE_DETAIL_FIELD_LENGTH = 160;
const MAX_REVIEW_INTENTS = 5;
const MAX_REVIEW_INTENT_INPUT_ITEMS = 20;
const MAX_REVIEW_INTENT_FIELD_LENGTH = 160;

function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim().slice(0, MAX_KEY_PHRASE_DETAIL_FIELD_LENGTH).trimEnd();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function sanitizeKeyPhraseDetails(value: unknown): SessionKeyPhraseDetail[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const details: SessionKeyPhraseDetail[] = [];

  for (const item of value.slice(0, MAX_KEY_PHRASE_DETAIL_INPUT_ITEMS)) {
    if (details.length >= MAX_KEY_PHRASE_DETAILS) {
      break;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const raw = item as Record<string, unknown>;
    const japanese = trimOptionalString(raw.japanese);
    const romaji = trimOptionalString(raw.romaji);
    const english = trimOptionalString(raw.english);
    const usage = trimOptionalString(raw.usage);

    if (!japanese && !romaji && !english) {
      continue;
    }

    const detail: SessionKeyPhraseDetail = {};
    if (japanese) detail.japanese = japanese;
    if (romaji) detail.romaji = romaji;
    if (english) detail.english = english;
    if (usage) detail.usage = usage;

    details.push(detail);
  }

  return details;
}

export function sanitizeReviewIntents(value: unknown): SessionReviewIntent[] {
  if (!Array.isArray(value)) return [];

  const intents: SessionReviewIntent[] = [];
  for (const item of value.slice(0, MAX_REVIEW_INTENT_INPUT_ITEMS)) {
    if (intents.length >= MAX_REVIEW_INTENTS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const raw = item as Record<string, unknown>;
    if (
      (raw.type !== 'key_phrase' && raw.type !== 'lesson_topic') ||
      raw.reviewRequested !== true
    ) {
      continue;
    }

    const identity =
      typeof raw.identity === 'string'
        ? raw.identity.trim().slice(0, MAX_REVIEW_INTENT_FIELD_LENGTH).trimEnd()
        : '';
    const display =
      typeof raw.display === 'string'
        ? raw.display.trim().slice(0, MAX_REVIEW_INTENT_FIELD_LENGTH).trimEnd()
        : '';
    const reason =
      typeof raw.reason === 'string'
        ? raw.reason.trim().slice(0, MAX_REVIEW_INTENT_FIELD_LENGTH).trimEnd()
        : '';
    if (!identity || !display || !reason) continue;

    intents.push({
      type: raw.type,
      identity,
      display,
      reason,
      reviewRequested: true,
    });
  }

  return intents;
}

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

function parseLevelUpRecommendation(value: unknown): LevelUpRecommendation | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const raw = value as Record<string, unknown>;
  if (
    typeof raw.recommendedLevel !== 'string' ||
    !LEVEL_ORDER.includes(raw.recommendedLevel as LevelUpRecommendation['recommendedLevel']) ||
    typeof raw.reason !== 'string' ||
    !raw.reason.trim()
  ) {
    return undefined;
  }

  return {
    recommendedLevel: raw.recommendedLevel as LevelUpRecommendation['recommendedLevel'],
    reason: raw.reason,
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
  const levelUpRecommendation = parseLevelUpRecommendation(parsed.levelUpRecommendation);
  const keyPhraseDetails = sanitizeKeyPhraseDetails(parsed.keyPhraseDetails);
  const reviewIntents = sanitizeReviewIntents(parsed.reviewIntents);

  return {
    summaryText: parsed.summaryText,
    category: typeof parsed.category === 'string' ? parsed.category : undefined,
    learningObjectiveId:
      typeof parsed.learningObjectiveId === 'string' ? parsed.learningObjectiveId : undefined,
    topic: parsed.topic,
    accuracy: parsed.accuracy,
    strengths: asStringArray(parsed.strengths),
    weaknesses: asStringArray(parsed.weaknesses),
    nextSteps: nextSteps.length > 0 ? nextSteps : undefined,
    handoffNotes: handoffNotes.length > 0 ? handoffNotes : undefined,
    reviewIntents: reviewIntents.length > 0 ? reviewIntents : undefined,
    exerciseTypes: asStringArray(parsed.exerciseTypes),
    keyPhrases: asStringArray(parsed.keyPhrases),
    keyPhraseDetails: keyPhraseDetails.length > 0 ? keyPhraseDetails : undefined,
    culturalNote: typeof parsed.culturalNote === 'string' ? parsed.culturalNote : undefined,
    miniLesson,
    levelUpRecommendation,
    hadLevelUpRecommendation:
      typeof parsed.hadLevelUpRecommendation === 'boolean'
        ? parsed.hadLevelUpRecommendation
        : undefined,
    coverageSource:
      parsed.coverageSource === 'server_generated_plan' ||
      parsed.coverageSource === 'legacy_client_fallback'
        ? parsed.coverageSource
        : undefined,
  };
}

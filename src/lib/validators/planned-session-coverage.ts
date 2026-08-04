import type { Lesson, PlannedSessionCoverage } from '$lib/types';
import { parseJsonObject } from './common';
import { sanitizeKeyPhraseDetails } from './session-meta';

const MAX_CATEGORY_LENGTH = 80;
const MAX_OBJECTIVE_ID_LENGTH = 160;
const MAX_LESSON_TOPIC_LENGTH = 240;
const MAX_CULTURAL_NOTE_LENGTH = 1_000;

function boundedRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, maxLength).trimEnd();
  return normalized || null;
}

function boundedOptionalString(value: unknown, maxLength: number): string | undefined {
  return boundedRequiredString(value, maxLength) ?? undefined;
}

export function buildPlannedSessionCoverage(input: {
  lesson: Lesson;
  learningObjectiveId?: unknown;
}): PlannedSessionCoverage {
  const category = boundedRequiredString(input.lesson.category, MAX_CATEGORY_LENGTH);
  const lessonTopic = boundedRequiredString(input.lesson.topic, MAX_LESSON_TOPIC_LENGTH);
  if (!category || !lessonTopic) {
    throw new Error('Generated Learning Session is missing required coverage metadata.');
  }

  const coverage: PlannedSessionCoverage = {
    version: 1,
    category,
    lessonTopic,
    culturalNote: boundedOptionalString(input.lesson.culturalNote, MAX_CULTURAL_NOTE_LENGTH) ?? '',
    keyPhraseDetails: sanitizeKeyPhraseDetails(input.lesson.keyPhrases),
  };
  const learningObjectiveId = boundedOptionalString(
    input.learningObjectiveId,
    MAX_OBJECTIVE_ID_LENGTH,
  );
  if (learningObjectiveId) coverage.learningObjectiveId = learningObjectiveId;
  return coverage;
}

export function parsePlannedSessionCoverage(
  value: string | null | undefined,
): PlannedSessionCoverage | null {
  if (!value) return null;
  const parsed = parseJsonObject(value);
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.keyPhraseDetails)) return null;

  const category = boundedRequiredString(parsed.category, MAX_CATEGORY_LENGTH);
  const lessonTopic = boundedRequiredString(parsed.lessonTopic, MAX_LESSON_TOPIC_LENGTH);
  if (!category || !lessonTopic || typeof parsed.culturalNote !== 'string') return null;

  const coverage: PlannedSessionCoverage = {
    version: 1,
    category,
    lessonTopic,
    culturalNote: boundedOptionalString(parsed.culturalNote, MAX_CULTURAL_NOTE_LENGTH) ?? '',
    keyPhraseDetails: sanitizeKeyPhraseDetails(parsed.keyPhraseDetails),
  };
  const learningObjectiveId = boundedOptionalString(
    parsed.learningObjectiveId,
    MAX_OBJECTIVE_ID_LENGTH,
  );
  if (learningObjectiveId) coverage.learningObjectiveId = learningObjectiveId;
  return coverage;
}

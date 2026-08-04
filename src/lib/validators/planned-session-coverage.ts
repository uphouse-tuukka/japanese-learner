import { isTopicCategoryKey } from '$lib/topic-categories';
import { getLearningObjective } from '$lib/learning-objectives';
import type { Exercise, KeyPhrase, Lesson, PlannedSessionCoverage } from '$lib/types';
import { parseJsonObject } from './common';
import { sanitizeKeyPhraseDetails } from './session-meta';

const MAX_OBJECTIVE_ID_LENGTH = 160;
const MAX_LESSON_TOPIC_LENGTH = 240;
const MAX_LESSON_TREATMENT_LENGTH = 12_000;
const MAX_CULTURAL_NOTE_LENGTH = 1_000;

function boundedRequiredString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, maxLength).trimEnd();
  return normalized || null;
}

function boundedOptionalString(value: unknown, maxLength: number): string | undefined {
  return boundedRequiredString(value, maxLength) ?? undefined;
}

function hasCompleteLessonTreatment(value: string): boolean {
  const treatment = parseJsonObject(value);
  return Boolean(
    treatment &&
    typeof treatment.topic === 'string' &&
    typeof treatment.explanation === 'string' &&
    Array.isArray(treatment.exercises),
  );
}

function normalizePlannedSessionCoverage(value: unknown): PlannedSessionCoverage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const parsed = value as Record<string, unknown>;
  if (parsed.version !== 1 || !isTopicCategoryKey(parsed.category)) return null;

  const lessonTopic = boundedRequiredString(parsed.lessonTopic, MAX_LESSON_TOPIC_LENGTH);
  const learningObjectiveId = boundedRequiredString(
    parsed.learningObjectiveId,
    MAX_OBJECTIVE_ID_LENGTH,
  );
  const learningObjective = learningObjectiveId ? getLearningObjective(learningObjectiveId) : null;
  const culturalNote = boundedRequiredString(parsed.culturalNote, MAX_CULTURAL_NOTE_LENGTH);
  const keyPhraseDetails = sanitizeKeyPhraseDetails(parsed.keyPhraseDetails);
  if (
    !lessonTopic ||
    !learningObjective ||
    learningObjective.category !== parsed.category ||
    !culturalNote ||
    keyPhraseDetails.length < 3 ||
    keyPhraseDetails.length > 5 ||
    keyPhraseDetails.some(
      (phrase) => !phrase.japanese || !phrase.romaji || !phrase.english || !phrase.usage,
    )
  ) {
    return null;
  }

  const coverage: PlannedSessionCoverage = {
    version: 1,
    category: parsed.category,
    learningObjectiveId: learningObjective.id,
    lessonTopic,
    culturalNote,
    keyPhraseDetails: keyPhraseDetails as KeyPhrase[],
  };
  const lessonTreatment = boundedOptionalString(
    parsed.lessonTreatment,
    MAX_LESSON_TREATMENT_LENGTH,
  );
  if (lessonTreatment) coverage.lessonTreatment = lessonTreatment;
  if (
    lessonTreatment &&
    parsed.lessonTreatmentComplete === true &&
    typeof parsed.lessonTreatment === 'string' &&
    parsed.lessonTreatment.trim().length <= MAX_LESSON_TREATMENT_LENGTH &&
    hasCompleteLessonTreatment(lessonTreatment)
  ) {
    coverage.lessonTreatmentComplete = true;
  }
  return coverage;
}

export function buildPlannedSessionCoverage(input: {
  lesson: Lesson;
  exercises: Exercise[];
  learningObjectiveId: unknown;
}): PlannedSessionCoverage {
  const lessonTreatment = JSON.stringify({
    topic: input.lesson.topic,
    explanation: input.lesson.explanation,
    exercises: input.exercises,
  });
  const coverage = normalizePlannedSessionCoverage({
    version: 1,
    category: input.lesson.category,
    learningObjectiveId: input.learningObjectiveId,
    lessonTopic: input.lesson.topic,
    lessonTreatment,
    lessonTreatmentComplete:
      lessonTreatment.length <= MAX_LESSON_TREATMENT_LENGTH ? true : undefined,
    culturalNote: input.lesson.culturalNote,
    keyPhraseDetails: input.lesson.keyPhrases,
  });
  if (!coverage) {
    throw new Error('Generated Learning Session is missing required coverage metadata.');
  }
  return coverage;
}

export function parsePlannedSessionCoverage(
  value: string | null | undefined,
): PlannedSessionCoverage | null {
  if (!value) return null;
  return normalizePlannedSessionCoverage(parseJsonObject(value));
}

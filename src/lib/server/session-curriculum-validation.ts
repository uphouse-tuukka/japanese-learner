import {
  normalizeTopicIdentity,
  phrasesShareIdentity,
  type CoverageEvidence,
  type CoveredKeyPhrase,
} from '$lib/server/session-coverage-evidence';
import { isTopicCategoryKey, type TopicCategoryKey } from '$lib/server/topic-categories';
import type { Lesson } from '$lib/types';

export type SessionCurriculumValidationReasonCode =
  | 'category_mismatch'
  | 'blocked_category'
  | 'repeated_lesson_topic'
  | 'repeated_key_phrases';

export type SessionCurriculumValidationDetails = {
  selectedCategory: TopicCategoryKey;
  generatedCategory: string | null;
  blockedCategories: TopicCategoryKey[];
  preferredCategories: TopicCategoryKey[];
  allowedCategories: TopicCategoryKey[];
  repeatedNonReviewKeyPhraseCount: number;
  repeatedNonReviewKeyPhrases: string[];
  repeatedLessonTopic: string | null;
};

export type SessionCurriculumValidationResult =
  | {
      valid: true;
      reasonCodes: [];
      details: SessionCurriculumValidationDetails;
    }
  | {
      valid: false;
      reasonCodes: SessionCurriculumValidationReasonCode[];
      details: SessionCurriculumValidationDetails;
    };

type GeneratedSessionPlanLike = {
  lesson: Pick<Lesson, 'topic' | 'category' | 'keyPhrases'>;
};

function displayKeyPhrase(phrase: Lesson['keyPhrases'][number]): string {
  const japanese = phrase.japanese.trim();
  const romaji = phrase.romaji.trim();
  if (japanese && romaji) return `${japanese} (${romaji})`;
  return japanese || romaji || phrase.english.trim() || 'unknown phrase';
}

function hasReviewCandidateForTopic(
  topicIdentity: string,
  coverageEvidence: CoverageEvidence,
): boolean {
  return coverageEvidence.reviewCandidates.some(
    (candidate) =>
      candidate.type === 'lesson_topic' &&
      (candidate.identity === topicIdentity || candidate.topicIdentity === topicIdentity),
  );
}

function hasReviewCandidateForPhrase(
  coveredPhrase: CoveredKeyPhrase,
  coverageEvidence: CoverageEvidence,
): boolean {
  return coverageEvidence.reviewCandidates.some(
    (candidate) =>
      candidate.type === 'key_phrase' &&
      (candidate.identity === coveredPhrase.primaryIdentity ||
        coveredPhrase.identities.includes(candidate.identity)),
  );
}

function phraseRepeatsCoveredNonReviewPhrase(
  generatedPhrase: Lesson['keyPhrases'][number],
  coverageEvidence: CoverageEvidence,
): boolean {
  return coverageEvidence.coveredKeyPhrases.some(
    (coveredPhrase) =>
      phrasesShareIdentity(generatedPhrase, coveredPhrase) &&
      !hasReviewCandidateForPhrase(coveredPhrase, coverageEvidence),
  );
}

export function validateGeneratedSessionPlan(input: {
  plan: GeneratedSessionPlanLike;
  coverageEvidence: CoverageEvidence;
}): SessionCurriculumValidationResult {
  const { plan, coverageEvidence } = input;
  const categoryRotation = coverageEvidence.categoryRotation;
  const selectedCategory = categoryRotation.selectedCategory;
  const generatedCategory = plan.lesson.category ?? null;
  const reasonCodes: SessionCurriculumValidationReasonCode[] = [];

  if (generatedCategory !== selectedCategory) {
    reasonCodes.push('category_mismatch');
  }

  if (
    isTopicCategoryKey(generatedCategory) &&
    categoryRotation.blockedCategories.includes(generatedCategory)
  ) {
    reasonCodes.push('blocked_category');
  }

  const generatedTopicIdentity = normalizeTopicIdentity(plan.lesson.topic);
  const repeatedLessonTopic = generatedTopicIdentity
    ? (coverageEvidence.coveredTopics.find((topic) => topic.identity === generatedTopicIdentity) ??
      null)
    : null;
  if (
    generatedTopicIdentity &&
    repeatedLessonTopic &&
    !hasReviewCandidateForTopic(generatedTopicIdentity, coverageEvidence)
  ) {
    reasonCodes.push('repeated_lesson_topic');
  }

  const repeatedNonReviewKeyPhrases = plan.lesson.keyPhrases
    .filter((phrase) => phraseRepeatsCoveredNonReviewPhrase(phrase, coverageEvidence))
    .map(displayKeyPhrase);
  const uniqueRepeatedNonReviewKeyPhrases = Array.from(new Set(repeatedNonReviewKeyPhrases));
  if (uniqueRepeatedNonReviewKeyPhrases.length > 1) {
    reasonCodes.push('repeated_key_phrases');
  }

  const details: SessionCurriculumValidationDetails = {
    selectedCategory,
    generatedCategory,
    blockedCategories: categoryRotation.blockedCategories,
    preferredCategories: categoryRotation.preferredCategories,
    allowedCategories: categoryRotation.allowedCategories,
    repeatedNonReviewKeyPhraseCount: uniqueRepeatedNonReviewKeyPhrases.length,
    repeatedNonReviewKeyPhrases: uniqueRepeatedNonReviewKeyPhrases,
    repeatedLessonTopic: repeatedLessonTopic?.topic ?? null,
  };

  return reasonCodes.length === 0
    ? { valid: true, reasonCodes: [], details }
    : { valid: false, reasonCodes, details };
}

import {
  normalizeTopicIdentity,
  phrasesShareIdentity,
  type CoverageEvidence,
  type CoveredKeyPhrase,
  type ReviewCandidate,
} from '$lib/server/session-coverage-evidence';
import { getLearningObjective } from '$lib/learning-objectives';
import { isTopicCategoryKey, type TopicCategoryKey } from '$lib/topic-categories';
import type { Lesson } from '$lib/types';

export type SessionCurriculumValidationReasonCode =
  | 'category_mismatch'
  | 'blocked_category'
  | 'invalid_learning_objective_identity'
  | 'learning_objective_mismatch'
  | 'repeated_learning_objective'
  | 'ineligible_review'
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
  selectedLearningObjectiveId: string | null;
  generatedLearningObjectiveId: string | null;
  generatedLearningObjectiveStatus:
    | 'missing'
    | 'unrecognized'
    | 'recognized_selected'
    | 'recognized_other';
  intentionalReviewStatus:
    | 'not_applicable'
    | 'missing'
    | 'invalid'
    | 'candidate_mismatch'
    | 'objective_mismatch'
    | 'stale_or_resolved'
    | 'unrelated'
    | 'duplicate_treatment'
    | 'eligible';
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
  metadata: Record<string, unknown>;
};

type IntentionalReviewClaim = {
  candidateType: 'key_phrase' | 'lesson_topic';
  candidateIdentity: string;
  learningObjectiveId: string;
  transferTask: string;
};

function parseIntentionalReviewClaim(value: unknown): IntentionalReviewClaim | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const claim = value as Record<string, unknown>;
  const candidateType = claim.candidateType;
  const candidateIdentity =
    typeof claim.candidateIdentity === 'string' ? claim.candidateIdentity.trim() : '';
  const learningObjectiveId =
    typeof claim.learningObjectiveId === 'string' ? claim.learningObjectiveId.trim() : '';
  const transferTask = typeof claim.transferTask === 'string' ? claim.transferTask.trim() : '';
  if (
    (candidateType !== 'key_phrase' && candidateType !== 'lesson_topic') ||
    !candidateIdentity ||
    !learningObjectiveId ||
    !transferTask
  ) {
    return null;
  }
  return { candidateType, candidateIdentity, learningObjectiveId, transferTask };
}

function duplicatesOriginalTreatment(
  transferTask: string,
  generatedTopic: string,
  candidate: ReviewCandidate,
): boolean {
  const transferIdentity = normalizeTopicIdentity(transferTask);
  const generatedTopicIdentity = normalizeTopicIdentity(generatedTopic);
  if (!transferIdentity || !generatedTopicIdentity) return true;
  const originalTreatmentIdentities = [
    candidate.identity,
    candidate.display,
    candidate.topicIdentity,
    candidate.topic,
  ]
    .map((value) => (typeof value === 'string' ? normalizeTopicIdentity(value) : null))
    .filter((value): value is string => Boolean(value));
  return (
    originalTreatmentIdentities.includes(transferIdentity) ||
    originalTreatmentIdentities.includes(generatedTopicIdentity)
  );
}

function reviewCandidateMatchesSelectedObjective(
  candidate: ReviewCandidate,
  coverageEvidence: CoverageEvidence,
): boolean {
  const selectedObjectiveId = coverageEvidence.learningObjectiveSelection.objective?.id;
  const coveredObjective = coverageEvidence.coveredLearningObjectives.find(
    (objective) => objective.id === selectedObjectiveId,
  );
  if (!coveredObjective) return false;
  return (
    candidate.evidenceSessionIds.some((sessionId) =>
      coveredObjective.sessionIds.includes(sessionId),
    ) ||
    (candidate.category === coveredObjective.category &&
      Boolean(
        candidate.topicIdentity &&
        coveredObjective.topicIdentities.includes(candidate.topicIdentity),
      ))
  );
}

function displayKeyPhrase(phrase: Lesson['keyPhrases'][number]): string {
  const japanese = phrase.japanese.trim();
  const romaji = phrase.romaji.trim();
  if (japanese && romaji) return `${japanese} (${romaji})`;
  return japanese || romaji || phrase.english.trim() || 'unknown phrase';
}

function reviewCandidateMatchesTopic(
  candidate: ReviewCandidate | null,
  topicIdentity: string,
): boolean {
  return Boolean(
    candidate?.type === 'lesson_topic' &&
    (candidate.identity === topicIdentity || candidate.topicIdentity === topicIdentity),
  );
}

function reviewCandidateMatchesPhrase(
  candidate: ReviewCandidate | null,
  coveredPhrase: CoveredKeyPhrase,
): boolean {
  return Boolean(
    candidate?.type === 'key_phrase' &&
    (candidate.identity === coveredPhrase.primaryIdentity ||
      coveredPhrase.identities.includes(candidate.identity)),
  );
}

function phraseRepeatsCoveredNonReviewPhrase(
  generatedPhrase: Lesson['keyPhrases'][number],
  coverageEvidence: CoverageEvidence,
  approvedReviewCandidate: ReviewCandidate | null,
): boolean {
  return coverageEvidence.coveredKeyPhrases.some(
    (coveredPhrase) =>
      phrasesShareIdentity(generatedPhrase, coveredPhrase) &&
      !reviewCandidateMatchesPhrase(approvedReviewCandidate, coveredPhrase),
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
  const selectedLearningObjective = coverageEvidence.learningObjectiveSelection.objective;
  const generatedLearningObjectiveId =
    typeof plan.metadata.learningObjectiveId === 'string' &&
    plan.metadata.learningObjectiveId.trim()
      ? plan.metadata.learningObjectiveId.trim()
      : null;
  const generatedLearningObjective = generatedLearningObjectiveId
    ? getLearningObjective(generatedLearningObjectiveId)
    : null;
  const generatedLearningObjectiveStatus = !generatedLearningObjectiveId
    ? 'missing'
    : !generatedLearningObjective
      ? 'unrecognized'
      : generatedLearningObjective.id === selectedLearningObjective?.id
        ? 'recognized_selected'
        : 'recognized_other';
  const rawIntentionalReview = plan.metadata.intentionalReview;
  const intentionalReviewClaim = parseIntentionalReviewClaim(rawIntentionalReview);
  const selectedReviewCandidate = coverageEvidence.learningObjectiveSelection.reviewCandidate;
  let intentionalReviewStatus: SessionCurriculumValidationDetails['intentionalReviewStatus'] =
    'not_applicable';
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

  if (coverageEvidence.learningObjectiveSelection.mode === 'canonical') {
    if (
      !selectedLearningObjective ||
      !generatedLearningObjective ||
      generatedLearningObjective.category !== selectedCategory
    ) {
      reasonCodes.push('invalid_learning_objective_identity');
    } else if (generatedLearningObjective.id !== selectedLearningObjective.id) {
      const repeatsCoveredObjective = coverageEvidence.coveredLearningObjectives.some(
        (objective) => objective.id === generatedLearningObjective.id,
      );
      reasonCodes.push(
        repeatsCoveredObjective ? 'repeated_learning_objective' : 'learning_objective_mismatch',
      );
    }
  } else if (generatedLearningObjectiveId) {
    reasonCodes.push('invalid_learning_objective_identity');
  }

  if (selectedReviewCandidate) {
    const candidateIsCurrent = coverageEvidence.reviewCandidates.some(
      (candidate) =>
        candidate.type === selectedReviewCandidate.type &&
        candidate.identity === selectedReviewCandidate.identity &&
        candidate.lastSeenAt === selectedReviewCandidate.lastSeenAt,
    );
    if (!candidateIsCurrent) {
      intentionalReviewStatus = 'stale_or_resolved';
      reasonCodes.push('ineligible_review');
    } else if (
      !reviewCandidateMatchesSelectedObjective(selectedReviewCandidate, coverageEvidence)
    ) {
      intentionalReviewStatus = 'unrelated';
      reasonCodes.push('ineligible_review');
    } else if (rawIntentionalReview === undefined || rawIntentionalReview === null) {
      intentionalReviewStatus = 'missing';
      reasonCodes.push('ineligible_review');
    } else if (!intentionalReviewClaim) {
      intentionalReviewStatus = 'invalid';
      reasonCodes.push('ineligible_review');
    } else if (
      intentionalReviewClaim.candidateType !== selectedReviewCandidate.type ||
      intentionalReviewClaim.candidateIdentity !== selectedReviewCandidate.identity
    ) {
      intentionalReviewStatus = 'candidate_mismatch';
      reasonCodes.push('ineligible_review');
    } else if (intentionalReviewClaim.learningObjectiveId !== selectedLearningObjective?.id) {
      intentionalReviewStatus = 'objective_mismatch';
      reasonCodes.push('ineligible_review');
    } else if (
      duplicatesOriginalTreatment(
        intentionalReviewClaim.transferTask,
        plan.lesson.topic,
        selectedReviewCandidate,
      )
    ) {
      intentionalReviewStatus = 'duplicate_treatment';
      reasonCodes.push('ineligible_review');
    } else {
      intentionalReviewStatus = 'eligible';
    }
  } else if (rawIntentionalReview !== undefined && rawIntentionalReview !== null) {
    intentionalReviewStatus = 'invalid';
    reasonCodes.push('ineligible_review');
  }
  const approvedReviewCandidate =
    intentionalReviewStatus === 'eligible' ? selectedReviewCandidate : null;

  const generatedTopicIdentity = normalizeTopicIdentity(plan.lesson.topic);
  const repeatedLessonTopic = generatedTopicIdentity
    ? (coverageEvidence.coveredTopics.find((topic) => topic.identity === generatedTopicIdentity) ??
      null)
    : null;
  if (
    generatedTopicIdentity &&
    repeatedLessonTopic &&
    !reviewCandidateMatchesTopic(approvedReviewCandidate, generatedTopicIdentity)
  ) {
    reasonCodes.push('repeated_lesson_topic');
  }

  const repeatedNonReviewKeyPhrases = plan.lesson.keyPhrases
    .filter((phrase) =>
      phraseRepeatsCoveredNonReviewPhrase(phrase, coverageEvidence, approvedReviewCandidate),
    )
    .map(displayKeyPhrase);
  const uniqueRepeatedNonReviewKeyPhrases = Array.from(new Set(repeatedNonReviewKeyPhrases));
  if (uniqueRepeatedNonReviewKeyPhrases.length > 0) {
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
    selectedLearningObjectiveId: selectedLearningObjective?.id ?? null,
    generatedLearningObjectiveId,
    generatedLearningObjectiveStatus,
    intentionalReviewStatus,
  };

  return reasonCodes.length === 0
    ? { valid: true, reasonCodes: [], details }
    : { valid: false, reasonCodes, details };
}

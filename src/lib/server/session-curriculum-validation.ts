import {
  normalizeTopicIdentity,
  phrasesShareIdentity,
  type CoverageEvidence,
  type CoveredKeyPhrase,
  type ReviewCandidate,
} from '$lib/server/session-coverage-evidence';
import { getLearningObjective, type LearningObjective } from '$lib/learning-objectives';
import {
  intentionalReviewTransferContextIsGrounded,
  isIntentionalReviewClaim,
  normalizeIntentionalReviewClaim,
  selectIntentionalReviewTransferContext,
} from '$lib/server/session-intentional-review';
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
    | 'context_mismatch'
    | 'context_not_grounded'
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
  lesson: Pick<Lesson, 'topic' | 'category' | 'explanation' | 'keyPhrases'>;
  metadata: Record<string, unknown>;
};

function duplicatesOriginalTreatment(
  transferTask: string,
  generatedTopic: string,
  candidate: ReviewCandidate,
  objective: LearningObjective | null,
): boolean {
  const transferIdentity = normalizeTopicIdentity(transferTask);
  const generatedTopicIdentity = normalizeTopicIdentity(generatedTopic);
  if (!transferIdentity || !generatedTopicIdentity) return true;
  const originalTreatmentIdentities = [
    candidate.identity,
    candidate.display,
    candidate.topicIdentity,
    candidate.topic,
    objective?.description,
    objective?.generationGuidance,
  ]
    .map((value) => (typeof value === 'string' ? normalizeTopicIdentity(value) : null))
    .filter((value): value is string => Boolean(value));
  return (
    originalTreatmentIdentities.some((identity) =>
      materiallyRestatesTreatment(transferIdentity, identity),
    ) ||
    originalTreatmentIdentities.some((identity) =>
      materiallyRestatesTreatment(generatedTopicIdentity, identity),
    )
  );
}

const TREATMENT_STOP_TOKENS = new Set([
  'again',
  'another',
  'during',
  'drill',
  'from',
  'lesson',
  'more',
  'once',
  'person',
  'practice',
  'practicing',
  'repeat',
  'repeating',
  'review',
  'reviewing',
  'revisit',
  'revisiting',
  'say',
  'saying',
  'someone',
  'task',
  'teach',
  'that',
  'this',
  'while',
  'with',
  'you',
  'your',
]);

function treatmentContentTokens(identity: string): string[] {
  return identity
    .split(' ')
    .filter((token) => token.length >= 3 && !TREATMENT_STOP_TOKENS.has(token));
}

function treatmentTokensMatch(left: string, right: string): boolean {
  return (
    left === right ||
    (left.length >= 5 && right.length >= 5 && left.slice(0, 5) === right.slice(0, 5))
  );
}

function materiallyRestatesTreatment(value: string, reference: string): boolean {
  const valueTokens = treatmentContentTokens(value);
  const referenceTokens = treatmentContentTokens(reference);
  if (valueTokens.length === 0 || referenceTokens.length === 0) return value === reference;

  const unusedReferenceTokens = [...referenceTokens];
  let matchingTokenCount = 0;
  for (const valueToken of valueTokens) {
    const matchingIndex = unusedReferenceTokens.findIndex((referenceToken) =>
      treatmentTokensMatch(valueToken, referenceToken),
    );
    if (matchingIndex < 0) continue;
    matchingTokenCount += 1;
    unusedReferenceTokens.splice(matchingIndex, 1);
  }

  const overlapRatio = matchingTokenCount / Math.min(valueTokens.length, referenceTokens.length);
  const novelTokenCount = valueTokens.length - matchingTokenCount;
  return overlapRatio >= 0.75 && novelTokenCount < 2;
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
  const normalizedIntentionalReview = normalizeIntentionalReviewClaim(rawIntentionalReview);
  const intentionalReviewClaim = isIntentionalReviewClaim(normalizedIntentionalReview)
    ? normalizedIntentionalReview
    : null;
  const selectedReviewCandidate = coverageEvidence.learningObjectiveSelection.reviewCandidate;
  const selectedTransferContext = selectedReviewCandidate
    ? selectIntentionalReviewTransferContext(selectedReviewCandidate)
    : null;
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
    } else if (intentionalReviewClaim.transferContextId !== selectedTransferContext?.id) {
      intentionalReviewStatus = 'context_mismatch';
      reasonCodes.push('ineligible_review');
    } else if (
      !selectedTransferContext ||
      !intentionalReviewTransferContextIsGrounded(
        selectedTransferContext,
        [plan.lesson.topic, plan.lesson.explanation, intentionalReviewClaim.transferTask].join(' '),
      )
    ) {
      intentionalReviewStatus = 'context_not_grounded';
      reasonCodes.push('ineligible_review');
    } else if (
      duplicatesOriginalTreatment(
        intentionalReviewClaim.transferTask,
        plan.lesson.topic,
        selectedReviewCandidate,
        selectedLearningObjective,
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

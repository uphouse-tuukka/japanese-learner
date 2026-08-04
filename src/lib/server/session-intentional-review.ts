const MAX_INTENTIONAL_REVIEW_IDENTITY_LENGTH = 160;
const MAX_INTENTIONAL_REVIEW_TRANSFER_TASK_LENGTH = 320;

export type IntentionalReviewClaim = {
  candidateType: 'key_phrase' | 'lesson_topic';
  candidateIdentity: string;
  learningObjectiveId: string;
  transferTask: string;
};

type InvalidIntentionalReviewClaim = { invalid: true };

export type NormalizedIntentionalReviewClaim =
  | IntentionalReviewClaim
  | InvalidIntentionalReviewClaim
  | null
  | undefined;

function boundedField(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength).trimEnd();
}

export function normalizeIntentionalReviewClaim(value: unknown): NormalizedIntentionalReviewClaim {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return { invalid: true };

  const claim = value as Record<string, unknown>;
  const candidateType = claim.candidateType;
  const candidateIdentity = boundedField(
    claim.candidateIdentity,
    MAX_INTENTIONAL_REVIEW_IDENTITY_LENGTH,
  );
  const learningObjectiveId = boundedField(
    claim.learningObjectiveId,
    MAX_INTENTIONAL_REVIEW_IDENTITY_LENGTH,
  );
  const transferTask = boundedField(
    claim.transferTask,
    MAX_INTENTIONAL_REVIEW_TRANSFER_TASK_LENGTH,
  );
  if (
    (candidateType !== 'key_phrase' && candidateType !== 'lesson_topic') ||
    !candidateIdentity ||
    !learningObjectiveId ||
    !transferTask
  ) {
    return { invalid: true };
  }
  return { candidateType, candidateIdentity, learningObjectiveId, transferTask };
}

export function isIntentionalReviewClaim(
  value: NormalizedIntentionalReviewClaim,
): value is IntentionalReviewClaim {
  return Boolean(value && typeof value === 'object' && !('invalid' in value));
}

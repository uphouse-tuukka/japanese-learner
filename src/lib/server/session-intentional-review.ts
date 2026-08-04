const MAX_INTENTIONAL_REVIEW_IDENTITY_LENGTH = 160;
const MAX_INTENTIONAL_REVIEW_TRANSFER_TASK_LENGTH = 320;

export type IntentionalReviewClaim = {
  candidateType: 'key_phrase' | 'lesson_topic';
  candidateIdentity: string;
  learningObjectiveId: string;
  transferContextId: IntentionalReviewTransferContext['id'];
  transferTask: string;
};

export type IntentionalReviewTransferContext = {
  id: 'station_encounter' | 'hotel_lobby' | 'shop_counter' | 'street_encounter';
  label: string;
  cueTokens: string[];
};

const TRANSFER_CONTEXTS: IntentionalReviewTransferContext[] = [
  {
    id: 'station_encounter',
    label: 'a station or train encounter',
    cueTokens: ['station', 'train', 'platform'],
  },
  {
    id: 'hotel_lobby',
    label: 'a hotel lobby or reception encounter',
    cueTokens: ['hotel', 'lobby', 'reception'],
  },
  {
    id: 'shop_counter',
    label: 'a shop or store counter encounter',
    cueTokens: ['shop', 'store', 'counter'],
  },
  {
    id: 'street_encounter',
    label: 'an outdoor street encounter',
    cueTokens: ['street', 'outdoors', 'sidewalk'],
  },
];

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
  const transferContextId = claim.transferContextId;
  const transferContext = TRANSFER_CONTEXTS.find((context) => context.id === transferContextId);
  const transferTask = boundedField(
    claim.transferTask,
    MAX_INTENTIONAL_REVIEW_TRANSFER_TASK_LENGTH,
  );
  if (
    (candidateType !== 'key_phrase' && candidateType !== 'lesson_topic') ||
    !candidateIdentity ||
    !learningObjectiveId ||
    !transferContext ||
    !transferTask
  ) {
    return { invalid: true };
  }
  return {
    candidateType,
    candidateIdentity,
    learningObjectiveId,
    transferContextId: transferContext.id,
    transferTask,
  };
}

export function isIntentionalReviewClaim(
  value: NormalizedIntentionalReviewClaim,
): value is IntentionalReviewClaim {
  return Boolean(value && typeof value === 'object' && !('invalid' in value));
}

function normalizedWords(value: string): string[] {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

export function selectIntentionalReviewTransferContext(candidate: {
  identity: string;
  display: string;
  topicIdentity?: string;
  topic?: string;
}): IntentionalReviewTransferContext | null {
  const originalWords = new Set(
    normalizedWords(
      [candidate.identity, candidate.display, candidate.topicIdentity, candidate.topic]
        .filter(Boolean)
        .join(' '),
    ),
  );
  return (
    TRANSFER_CONTEXTS.find((context) =>
      context.cueTokens.every((token) => !originalWords.has(token)),
    ) ?? null
  );
}

export function intentionalReviewTransferContextIsGrounded(
  context: IntentionalReviewTransferContext,
  generatedText: string,
): boolean {
  const generatedWords = new Set(normalizedWords(generatedText));
  return context.cueTokens.some((token) => generatedWords.has(token));
}

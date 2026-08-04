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
  topicLabel: string;
  cueTokens: string[];
  requiredTaskPrefix: string;
};

export type IntentionalReviewTransferContextId = IntentionalReviewTransferContext['id'];

const TRANSFER_CONTEXTS: IntentionalReviewTransferContext[] = [
  {
    id: 'station_encounter',
    label: 'a station or train encounter',
    topicLabel: 'Station encounter review',
    cueTokens: ['station', 'train', 'platform'],
    requiredTaskPrefix: 'At a station,',
  },
  {
    id: 'hotel_lobby',
    label: 'a hotel lobby or reception encounter',
    topicLabel: 'Hotel lobby review',
    cueTokens: ['hotel', 'lobby', 'reception'],
    requiredTaskPrefix: 'In a hotel lobby,',
  },
  {
    id: 'shop_counter',
    label: 'a shop or store counter encounter',
    topicLabel: 'Shop counter review',
    cueTokens: ['shop', 'store', 'counter'],
    requiredTaskPrefix: 'At a shop counter,',
  },
  {
    id: 'street_encounter',
    label: 'an outdoor street encounter',
    topicLabel: 'Street encounter review',
    cueTokens: ['street', 'outdoors', 'sidewalk'],
    requiredTaskPrefix: 'On a city street,',
  },
];

const TRANSFER_CONTEXT_ALIASES: Record<IntentionalReviewTransferContextId, string[]> = {
  station_encounter: [
    'station',
    'train',
    'platform',
    'railway',
    'railroad',
    'railway terminal',
    'rail terminal',
    'carriage',
  ],
  hotel_lobby: ['hotel', 'lobby', 'reception', 'front desk', 'check in desk', 'inn', 'ryokan'],
  shop_counter: ['shop', 'store', 'counter', 'cashier', 'checkout', 'retail', 'boutique'],
  street_encounter: [
    'street',
    'outdoors',
    'sidewalk',
    'pavement',
    'roadside',
    'intersection',
    'pedestrian',
  ],
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

function normalizedText(value: string): string {
  return ` ${normalizedWords(value).join(' ')} `;
}

export function detectIntentionalReviewTransferContextIds(
  treatmentText: string,
): IntentionalReviewTransferContextId[] {
  const normalizedTreatment = normalizedText(treatmentText);
  return TRANSFER_CONTEXTS.filter((context) =>
    TRANSFER_CONTEXT_ALIASES[context.id].some((alias) =>
      normalizedTreatment.includes(normalizedText(alias)),
    ),
  ).map((context) => context.id);
}

export function selectIntentionalReviewTransferContext(candidate: {
  identity: string;
  display: string;
  topicIdentity?: string;
  topic?: string;
  originalTreatmentContextIds?: IntentionalReviewTransferContextId[];
  treatmentEvidenceComplete?: boolean;
}): IntentionalReviewTransferContext | null {
  if (candidate.treatmentEvidenceComplete === false) return null;
  const originalWords = new Set(
    normalizedWords(
      [candidate.identity, candidate.display, candidate.topicIdentity, candidate.topic]
        .filter(Boolean)
        .join(' '),
    ),
  );
  return (
    TRANSFER_CONTEXTS.find(
      (context) =>
        !candidate.originalTreatmentContextIds?.includes(context.id) &&
        context.cueTokens.every((token) => !originalWords.has(token)),
    ) ?? null
  );
}

export function buildIntentionalReviewTransferTask(
  context: IntentionalReviewTransferContext,
): string {
  return `${context.requiredTaskPrefix} apply the selected Learning Objective through a new interaction and transfer challenge.`;
}

export function buildIntentionalReviewLessonTopic(
  context: IntentionalReviewTransferContext,
  objectiveDescription: string,
): string {
  return `${context.topicLabel}: ${objectiveDescription}`;
}

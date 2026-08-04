import {
  TOPIC_CATEGORY_KEYS,
  isTopicCategoryKey,
  type TopicCategoryKey,
} from '$lib/topic-categories';
import {
  getLearningObjective,
  getLearningObjectivesForCategory,
  hasCanonicalLearningObjectives,
  type LearningObjective,
} from '$lib/learning-objectives';
import type { Exercise, KeyPhrase, Session, SessionKeyPhraseDetail, SessionMeta } from '$lib/types';
import { parseSessionMeta } from '$lib/validators/session-meta';

const MAX_PROMPT_AVOID_TOPICS = 20;
const MAX_PROMPT_AVOID_KEY_PHRASES = 30;
const MAX_PROMPT_REVIEW_CANDIDATES = 5;
const MAX_PROMPT_FIELD_LENGTH = 160;
const STRONG_REVIEW_CANDIDATE_THRESHOLD = 6;

export type CoverageSourceSession = {
  sessionId: string;
  createdAt: string;
  completedAt: string | null;
  meta: SessionMeta;
};

export type CoverageExerciseResult = {
  sessionId: string;
  exerciseId: string;
  orderIndex?: number;
  isCorrect: boolean;
  answerText: string;
  createdAt: string;
  exercise?: Exercise;
};

export type CoveredCategory = {
  category: TopicCategoryKey;
  count: number;
  sessionIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CoveredTopic = {
  identity: string;
  topic: string;
  category?: TopicCategoryKey;
  count: number;
  sessionIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CoveredLearningObjective = {
  id: string;
  category: TopicCategoryKey;
  count: number;
  sessionIds: string[];
  topicIdentities: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type CoveredKeyPhrase = {
  primaryIdentity: string;
  identities: string[];
  display: string;
  japanese?: string;
  romaji?: string;
  english?: string;
  usage?: string;
  category?: TopicCategoryKey;
  topicIdentity?: string;
  topic?: string;
  count: number;
  sessionIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type ReviewCandidateReasonCode =
  | 'wrong_exercise_result'
  | 'mixed_exercise_result'
  | 'structured_review_intent';

export type ReviewCandidate = {
  type: 'key_phrase' | 'lesson_topic';
  identity: string;
  display: string;
  category?: TopicCategoryKey;
  topicIdentity?: string;
  topic?: string;
  strength: number;
  reasonCodes: ReviewCandidateReasonCode[];
  evidenceSessionIds: string[];
  lastSeenAt: string;
};

export type CategorySelectionReason =
  | 'no_prior_category_beginner_flow'
  | 'continued_current_category_depth'
  | 'continued_current_category_for_review_candidate'
  | 'rotated_after_two_session_streak'
  | 'mandatory_rotation_after_three_session_streak'
  | 'rotated_to_available_learning_objective'
  | 'selected_ranked_candidate';

export type CategoryRotationEvidence = {
  currentCategory: TopicCategoryKey | null;
  currentCategoryStreak: number;
  selectedCategory: TopicCategoryKey;
  selectionReason: CategorySelectionReason;
  mustRotate: boolean;
  allowedCategories: TopicCategoryKey[];
  preferredCategories: TopicCategoryKey[];
  blockedCategories: TopicCategoryKey[];
};

export type LearningObjectiveSelectionReason =
  | 'selected_uncovered_objective'
  | 'selected_review_candidate_objective'
  | 'category_not_migrated_compatibility';

export type LearningObjectiveSelection = {
  mode: 'canonical' | 'legacy_exact_topic';
  reason: LearningObjectiveSelectionReason;
  objective: LearningObjective | null;
  reviewCandidate: ReviewCandidate | null;
};

export type CompactCoverageEvidence = {
  source: CoverageEvidence['source'];
  categoryRotation: CategoryRotationEvidence;
  learningObjectiveSelection: LearningObjectiveSelection;
  categoryCoverage: Array<{
    category: TopicCategoryKey;
    count: number;
    lastSeenAt: string;
  }>;
  avoidTopics: Array<{
    identity: string;
    topic: string;
    category?: TopicCategoryKey;
    count: number;
    lastSeenAt: string;
  }>;
  avoidKeyPhrases: Array<{
    primaryIdentity: string;
    identities: string[];
    display: string;
    category?: TopicCategoryKey;
    topic?: string;
    count: number;
    lastSeenAt: string;
  }>;
  reviewCandidates: ReviewCandidate[];
};

export type CoverageEvidence = {
  source: {
    totalCompletedAiSessions: number;
    parseableCompletedAiSessions: number;
    ignoredCompletedAiSessions: number;
  };
  categoryRotation: CategoryRotationEvidence;
  learningObjectiveSelection: LearningObjectiveSelection;
  coveredCategories: CoveredCategory[];
  coveredLearningObjectives: CoveredLearningObjective[];
  coveredTopics: CoveredTopic[];
  coveredKeyPhrases: CoveredKeyPhrase[];
  reviewCandidates: ReviewCandidate[];
  promptSnapshot: CompactCoverageEvidence;
};

export type ParseCoverageSourceSessionsResult = {
  sessions: CoverageSourceSession[];
  totalCompletedAiSessions: number;
  ignoredCompletedAiSessions: number;
};

type MutableCategory = Omit<CoveredCategory, 'sessionIds'> & { sessionIds: Set<string> };
type MutableLearningObjective = Omit<CoveredLearningObjective, 'sessionIds' | 'topicIdentities'> & {
  sessionIds: Set<string>;
  topicIdentities: Set<string>;
};
type MutableTopic = Omit<CoveredTopic, 'sessionIds'> & { sessionIds: Set<string> };
type MutablePhrase = Omit<CoveredKeyPhrase, 'identities' | 'sessionIds'> & {
  identities: Set<string>;
  sessionIds: Set<string>;
};
type MutableReviewCandidate = Omit<ReviewCandidate, 'reasonCodes' | 'evidenceSessionIds'> & {
  reasonCodes: Set<ReviewCandidateReasonCode>;
  evidenceSessionIds: Set<string>;
};

type PhraseLike = string | SessionKeyPhraseDetail | KeyPhrase | Exercise;

const JAPANESE_SCRIPT_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
const LATIN_SCRIPT_PATTERN = /[A-Za-z]/;

function dateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sessionSortDate(session: CoverageSourceSession): string {
  return session.completedAt ?? session.createdAt;
}

function compareIsoDesc(left: string, right: string): number {
  const diff = dateValue(right) - dateValue(left);
  if (diff !== 0) return diff;
  return left.localeCompare(right);
}

function latestIso(left: string, right: string): string {
  return dateValue(right) > dateValue(left) ? right : left;
}

function earliestIso(left: string, right: string): string {
  return dateValue(right) < dateValue(left) ? right : left;
}

function sortedNewestSessions(sessions: CoverageSourceSession[]): CoverageSourceSession[] {
  return [...sessions].sort((left, right) => {
    const diff = dateValue(sessionSortDate(right)) - dateValue(sessionSortDate(left));
    if (diff !== 0) return diff;
    return left.sessionId.localeCompare(right.sessionId);
  });
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeLatin(value: string): string {
  return compactWhitespace(
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' '),
  );
}

function normalizeJapanese(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々〆〤ヶヵ]+/gu, '')
    .trim();
}

function normalizeLooseIdentity(value: string): string {
  return compactWhitespace(
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}]+/gu, ' '),
  );
}

function hasJapaneseScript(value: string): boolean {
  return JAPANESE_SCRIPT_PATTERN.test(value);
}

function hasLatinScript(value: string): boolean {
  return LATIN_SCRIPT_PATTERN.test(value);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = compactWhitespace(value);
  return trimmed.length > 0 ? trimmed : undefined;
}

function asPhraseFields(value: PhraseLike): SessionKeyPhraseDetail {
  if (typeof value === 'string') {
    return { japanese: value };
  }

  const record = value as Partial<SessionKeyPhraseDetail> & Partial<Exercise>;

  return {
    japanese: normalizeOptionalString(record.japanese),
    romaji: normalizeOptionalString(record.romaji),
    english: normalizeOptionalString(record.english ?? record.englishContext),
    usage: normalizeOptionalString(record.usage),
  };
}

function parentheticalLatinAliases(value: string): string[] {
  const aliases: string[] = [];
  for (const match of value.matchAll(/[（(]([^()（）]+)[）)]/g)) {
    const alias = match[1];
    if (alias && hasLatinScript(alias)) {
      const normalized = normalizeLatin(alias);
      if (normalized) aliases.push(`romaji:${normalized}`);
    }
  }
  return aliases;
}

export function normalizeTopicIdentity(topic: string): string | null {
  const normalized = normalizeLooseIdentity(topic);
  return normalized.length > 0 ? normalized : null;
}

export function getPhraseIdentityKeys(value: PhraseLike): string[] {
  if (typeof value === 'string') {
    const source = compactWhitespace(value);
    if (!source) return [];

    const keys: string[] = [];
    if (hasJapaneseScript(source)) {
      const japanese = normalizeJapanese(source);
      if (japanese) keys.push(`ja:${japanese}`);
      keys.push(...parentheticalLatinAliases(source));
      return uniqueStrings(keys);
    }

    if (hasLatinScript(source)) {
      const romaji = normalizeLatin(source);
      return romaji ? [`romaji:${romaji}`] : [];
    }

    const english = normalizeLooseIdentity(source);
    return english ? [`english:${english}`] : [];
  }

  const fields = asPhraseFields(value);
  const keys: string[] = [];
  if (fields.japanese) {
    const japanese = normalizeJapanese(fields.japanese);
    if (japanese) keys.push(`ja:${japanese}`);
  }
  if (fields.romaji) {
    const romaji = normalizeLatin(fields.romaji);
    if (romaji) keys.push(`romaji:${romaji}`);
  }
  if (keys.length === 0 && fields.english) {
    const english = normalizeLooseIdentity(fields.english);
    if (english) keys.push(`english:${english}`);
  }

  return uniqueStrings(keys);
}

export function phrasesShareIdentity(left: PhraseLike, right: PhraseLike): boolean {
  const leftKeys = new Set(getPhraseIdentityKeys(left));
  if (leftKeys.size === 0) return false;
  return getPhraseIdentityKeys(right).some((key) => leftKeys.has(key));
}

function phraseDisplay(value: PhraseLike): string {
  if (typeof value === 'string') return compactWhitespace(value);
  const fields = asPhraseFields(value);
  if (fields.japanese && fields.romaji) return `${fields.japanese} (${fields.romaji})`;
  return fields.japanese ?? fields.romaji ?? fields.english ?? '';
}

function sourcePhraseItems(meta: SessionMeta): PhraseLike[] {
  if (meta.keyPhraseDetails && meta.keyPhraseDetails.length > 0) {
    return meta.keyPhraseDetails;
  }
  return meta.keyPhrases;
}

export function parseCoverageSourceSessions(
  sessions: Session[],
): ParseCoverageSourceSessionsResult {
  let totalCompletedAiSessions = 0;
  const parsedSessions: CoverageSourceSession[] = [];

  for (const session of sessions) {
    if (session.mode !== 'ai' || session.status !== 'completed') {
      continue;
    }

    totalCompletedAiSessions += 1;
    const meta = parseSessionMeta(session.summary);
    if (!meta) {
      continue;
    }

    parsedSessions.push({
      sessionId: session.id,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      meta,
    });
  }

  return {
    sessions: sortedNewestSessions(parsedSessions),
    totalCompletedAiSessions,
    ignoredCompletedAiSessions: totalCompletedAiSessions - parsedSessions.length,
  };
}

function addCategory(
  categories: Map<TopicCategoryKey, MutableCategory>,
  category: TopicCategoryKey,
  sessionId: string,
  seenAt: string,
): void {
  const current = categories.get(category);
  if (!current) {
    categories.set(category, {
      category,
      count: 1,
      sessionIds: new Set([sessionId]),
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    });
    return;
  }

  current.count += 1;
  current.sessionIds.add(sessionId);
  current.firstSeenAt = earliestIso(current.firstSeenAt, seenAt);
  current.lastSeenAt = latestIso(current.lastSeenAt, seenAt);
}

function addTopic(
  topics: Map<string, MutableTopic>,
  input: {
    identity: string;
    topic: string;
    category?: TopicCategoryKey;
    sessionId: string;
    seenAt: string;
  },
): void {
  const current = topics.get(input.identity);
  if (!current) {
    topics.set(input.identity, {
      identity: input.identity,
      topic: input.topic,
      category: input.category,
      count: 1,
      sessionIds: new Set([input.sessionId]),
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
    });
    return;
  }

  current.count += 1;
  current.sessionIds.add(input.sessionId);
  current.firstSeenAt = earliestIso(current.firstSeenAt, input.seenAt);
  current.lastSeenAt = latestIso(current.lastSeenAt, input.seenAt);
  if (!current.category && input.category) current.category = input.category;
}

function addLearningObjective(
  objectives: Map<string, MutableLearningObjective>,
  input: {
    id: string;
    category: TopicCategoryKey;
    topicIdentity?: string;
    sessionId: string;
    seenAt: string;
  },
): void {
  const current = objectives.get(input.id);
  if (!current) {
    objectives.set(input.id, {
      id: input.id,
      category: input.category,
      count: 1,
      sessionIds: new Set([input.sessionId]),
      topicIdentities: new Set(input.topicIdentity ? [input.topicIdentity] : []),
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
    });
    return;
  }

  current.count += 1;
  current.sessionIds.add(input.sessionId);
  if (input.topicIdentity) current.topicIdentities.add(input.topicIdentity);
  current.firstSeenAt = earliestIso(current.firstSeenAt, input.seenAt);
  current.lastSeenAt = latestIso(current.lastSeenAt, input.seenAt);
}

function addPhrase(
  phrases: Map<string, MutablePhrase>,
  identityToPrimary: Map<string, string>,
  input: {
    phrase: PhraseLike;
    keys: string[];
    category?: TopicCategoryKey;
    topic?: string;
    topicIdentity?: string;
    sessionId: string;
    seenAt: string;
  },
): void {
  const primaryIdentity =
    input.keys
      .map((key) => identityToPrimary.get(key))
      .find((key): key is string => Boolean(key)) ?? input.keys[0];
  if (!primaryIdentity) return;

  const fields = asPhraseFields(input.phrase);
  const display = phraseDisplay(input.phrase);
  const current = phrases.get(primaryIdentity);

  if (!current) {
    const next: MutablePhrase = {
      primaryIdentity,
      identities: new Set(input.keys),
      display,
      japanese: fields.japanese,
      romaji: fields.romaji,
      english: fields.english,
      usage: fields.usage,
      category: input.category,
      topic: input.topic,
      topicIdentity: input.topicIdentity,
      count: 1,
      sessionIds: new Set([input.sessionId]),
      firstSeenAt: input.seenAt,
      lastSeenAt: input.seenAt,
    };
    phrases.set(primaryIdentity, next);
    for (const key of input.keys) identityToPrimary.set(key, primaryIdentity);
    return;
  }

  current.count += 1;
  current.sessionIds.add(input.sessionId);
  current.firstSeenAt = earliestIso(current.firstSeenAt, input.seenAt);
  current.lastSeenAt = latestIso(current.lastSeenAt, input.seenAt);
  if (!current.japanese && fields.japanese) current.japanese = fields.japanese;
  if (!current.romaji && fields.romaji) current.romaji = fields.romaji;
  if (!current.english && fields.english) current.english = fields.english;
  if (!current.usage && fields.usage) current.usage = fields.usage;
  if (!current.category && input.category) current.category = input.category;
  if (!current.topic && input.topic) current.topic = input.topic;
  if (!current.topicIdentity && input.topicIdentity) current.topicIdentity = input.topicIdentity;
  for (const key of input.keys) {
    current.identities.add(key);
    identityToPrimary.set(key, primaryIdentity);
  }
}

function toCoveredCategories(
  categories: Map<TopicCategoryKey, MutableCategory>,
): CoveredCategory[] {
  return Array.from(categories.values())
    .map((category) => ({ ...category, sessionIds: Array.from(category.sessionIds) }))
    .sort(
      (left, right) =>
        TOPIC_CATEGORY_KEYS.indexOf(left.category) - TOPIC_CATEGORY_KEYS.indexOf(right.category),
    );
}

function compareCoverageRecencyThenCount(
  left: { identity?: string; primaryIdentity?: string; lastSeenAt: string; count: number },
  right: { identity?: string; primaryIdentity?: string; lastSeenAt: string; count: number },
): number {
  const dateDiff = compareIsoDesc(left.lastSeenAt, right.lastSeenAt);
  if (dateDiff !== 0) return dateDiff;
  const countDiff = right.count - left.count;
  if (countDiff !== 0) return countDiff;
  return (left.identity ?? left.primaryIdentity ?? '').localeCompare(
    right.identity ?? right.primaryIdentity ?? '',
  );
}

function toCoveredTopics(topics: Map<string, MutableTopic>): CoveredTopic[] {
  return Array.from(topics.values())
    .map((topic) => ({ ...topic, sessionIds: Array.from(topic.sessionIds) }))
    .sort(compareCoverageRecencyThenCount);
}

function toCoveredLearningObjectives(
  objectives: Map<string, MutableLearningObjective>,
): CoveredLearningObjective[] {
  return Array.from(objectives.values())
    .map((objective) => ({
      ...objective,
      sessionIds: Array.from(objective.sessionIds),
      topicIdentities: Array.from(objective.topicIdentities),
    }))
    .sort((left, right) => {
      const categoryDiff =
        TOPIC_CATEGORY_KEYS.indexOf(left.category) - TOPIC_CATEGORY_KEYS.indexOf(right.category);
      if (categoryDiff !== 0) return categoryDiff;
      return left.id.localeCompare(right.id);
    });
}

function toCoveredPhrases(phrases: Map<string, MutablePhrase>): CoveredKeyPhrase[] {
  return Array.from(phrases.values())
    .map((phrase) => ({
      ...phrase,
      identities: Array.from(phrase.identities).sort(),
      sessionIds: Array.from(phrase.sessionIds),
    }))
    .sort(compareCoverageRecencyThenCount);
}

function categoryRank(
  category: TopicCategoryKey,
  categories: Map<TopicCategoryKey, MutableCategory>,
): {
  visited: boolean;
  count: number;
  lastSeenValue: number;
  orderIndex: number;
} {
  const stat = categories.get(category);
  return {
    visited: Boolean(stat),
    count: stat?.count ?? 0,
    lastSeenValue: stat ? dateValue(stat.lastSeenAt) : 0,
    orderIndex: TOPIC_CATEGORY_KEYS.indexOf(category),
  };
}

function rankCategories(
  candidates: TopicCategoryKey[],
  categories: Map<TopicCategoryKey, MutableCategory>,
): TopicCategoryKey[] {
  return [...candidates].sort((left, right) => {
    const leftRank = categoryRank(left, categories);
    const rightRank = categoryRank(right, categories);
    if (leftRank.visited !== rightRank.visited) return leftRank.visited ? 1 : -1;
    if (leftRank.count !== rightRank.count) return leftRank.count - rightRank.count;
    if (
      leftRank.visited &&
      rightRank.visited &&
      leftRank.lastSeenValue !== rightRank.lastSeenValue
    ) {
      return leftRank.lastSeenValue - rightRank.lastSeenValue;
    }
    return leftRank.orderIndex - rightRank.orderIndex;
  });
}

function categoryHistory(sessions: CoverageSourceSession[]): Array<TopicCategoryKey | null> {
  return sessions.map((session) =>
    isTopicCategoryKey(session.meta.category) ? session.meta.category : null,
  );
}

function getCurrentCategoryStreak(categories: Array<TopicCategoryKey | null>): {
  currentCategory: TopicCategoryKey | null;
  currentCategoryStreak: number;
} {
  const currentCategory = categories[0] ?? null;
  if (!currentCategory) return { currentCategory: null, currentCategoryStreak: 0 };

  let streak = 0;
  for (const category of categories) {
    if (category !== currentCategory) break;
    streak += 1;
  }

  return { currentCategory, currentCategoryStreak: streak };
}

function hasStrongCurrentCategoryReviewCandidate(
  category: TopicCategoryKey,
  reviewCandidates: ReviewCandidate[],
): boolean {
  return reviewCandidates.some(
    (candidate) =>
      candidate.category === category && candidate.strength >= STRONG_REVIEW_CANDIDATE_THRESHOLD,
  );
}

function selectCategory(input: {
  sessions: CoverageSourceSession[];
  categories: Map<TopicCategoryKey, MutableCategory>;
  reviewCandidates: ReviewCandidate[];
}): CategoryRotationEvidence {
  const history = categoryHistory(input.sessions);
  const { currentCategory, currentCategoryStreak } = getCurrentCategoryStreak(history);
  const mustRotate = Boolean(currentCategory && currentCategoryStreak >= 3);
  const blockedCategories = mustRotate && currentCategory ? [currentCategory] : [];
  const allowedCategories = TOPIC_CATEGORY_KEYS.filter(
    (category) => !blockedCategories.includes(category),
  );
  const rankedAllowed = rankCategories(allowedCategories, input.categories);

  if (!currentCategory) {
    return {
      currentCategory: null,
      currentCategoryStreak: 0,
      selectedCategory: rankedAllowed[0] ?? 'greetings_basics',
      selectionReason: 'no_prior_category_beginner_flow',
      mustRotate: false,
      allowedCategories,
      preferredCategories: rankedAllowed,
      blockedCategories,
    };
  }

  if (currentCategoryStreak === 1 && allowedCategories.includes(currentCategory)) {
    const preferredCategories = [
      currentCategory,
      ...rankedAllowed.filter((category) => category !== currentCategory),
    ];
    return {
      currentCategory,
      currentCategoryStreak,
      selectedCategory: currentCategory,
      selectionReason: 'continued_current_category_depth',
      mustRotate: false,
      allowedCategories,
      preferredCategories,
      blockedCategories,
    };
  }

  if (currentCategoryStreak === 2 && allowedCategories.includes(currentCategory)) {
    const rankedRotationCandidates = rankedAllowed.filter(
      (category) => category !== currentCategory,
    );
    if (hasStrongCurrentCategoryReviewCandidate(currentCategory, input.reviewCandidates)) {
      return {
        currentCategory,
        currentCategoryStreak,
        selectedCategory: currentCategory,
        selectionReason: 'continued_current_category_for_review_candidate',
        mustRotate: false,
        allowedCategories,
        preferredCategories: [currentCategory, ...rankedRotationCandidates],
        blockedCategories,
      };
    }

    return {
      currentCategory,
      currentCategoryStreak,
      selectedCategory: rankedRotationCandidates[0] ?? currentCategory,
      selectionReason: 'rotated_after_two_session_streak',
      mustRotate: false,
      allowedCategories,
      preferredCategories: rankedRotationCandidates,
      blockedCategories,
    };
  }

  return {
    currentCategory,
    currentCategoryStreak,
    selectedCategory: rankedAllowed[0] ?? currentCategory,
    selectionReason: mustRotate
      ? 'mandatory_rotation_after_three_session_streak'
      : 'selected_ranked_candidate',
    mustRotate,
    allowedCategories,
    preferredCategories: rankedAllowed,
    blockedCategories,
  };
}

function reviewCandidateForObjective(
  objective: CoveredLearningObjective,
  reviewCandidates: ReviewCandidate[],
): ReviewCandidate | null {
  return (
    reviewCandidates.find(
      (candidate) =>
        candidate.evidenceSessionIds.some((sessionId) =>
          objective.sessionIds.includes(sessionId),
        ) ||
        (candidate.category === objective.category &&
          Boolean(
            candidate.topicIdentity && objective.topicIdentities.includes(candidate.topicIdentity),
          )),
    ) ?? null
  );
}

function selectObjectiveInCategory(input: {
  category: TopicCategoryKey;
  coveredLearningObjectives: CoveredLearningObjective[];
  reviewCandidates: ReviewCandidate[];
}): LearningObjectiveSelection | null {
  if (!hasCanonicalLearningObjectives(input.category)) {
    return {
      mode: 'legacy_exact_topic',
      reason: 'category_not_migrated_compatibility',
      objective: null,
      reviewCandidate: null,
    };
  }

  const objectives = getLearningObjectivesForCategory(input.category);
  const coveredById = new Map(
    input.coveredLearningObjectives
      .filter((objective) => objective.category === input.category)
      .map((objective) => [objective.id, objective] as const),
  );
  const uncovered = objectives.find((objective) => !coveredById.has(objective.id));
  if (uncovered) {
    return {
      mode: 'canonical',
      reason: 'selected_uncovered_objective',
      objective: uncovered,
      reviewCandidate: null,
    };
  }

  for (const candidate of input.reviewCandidates) {
    const coveredObjective = input.coveredLearningObjectives.find(
      (objective) =>
        objective.category === input.category &&
        (candidate.evidenceSessionIds.some((sessionId) =>
          objective.sessionIds.includes(sessionId),
        ) ||
          Boolean(
            candidate.topicIdentity && objective.topicIdentities.includes(candidate.topicIdentity),
          )),
    );
    if (!coveredObjective) continue;
    const objective = getLearningObjective(coveredObjective.id);
    if (!objective) continue;
    return {
      mode: 'canonical',
      reason: 'selected_review_candidate_objective',
      objective,
      reviewCandidate: reviewCandidateForObjective(coveredObjective, input.reviewCandidates),
    };
  }

  return null;
}

function selectLearningObjective(input: {
  categoryRotation: CategoryRotationEvidence;
  coveredLearningObjectives: CoveredLearningObjective[];
  reviewCandidates: ReviewCandidate[];
}): {
  categoryRotation: CategoryRotationEvidence;
  learningObjectiveSelection: LearningObjectiveSelection;
} {
  const categories = Array.from(
    new Set([
      input.categoryRotation.selectedCategory,
      ...input.categoryRotation.preferredCategories,
      ...input.categoryRotation.allowedCategories,
    ]),
  ).filter((category) => !input.categoryRotation.blockedCategories.includes(category));

  for (const category of categories) {
    const selection = selectObjectiveInCategory({
      category,
      coveredLearningObjectives: input.coveredLearningObjectives,
      reviewCandidates: input.reviewCandidates,
    });
    if (!selection) continue;
    if (category === input.categoryRotation.selectedCategory) {
      return {
        categoryRotation: input.categoryRotation,
        learningObjectiveSelection: selection,
      };
    }
    return {
      categoryRotation: {
        ...input.categoryRotation,
        selectedCategory: category,
        selectionReason: 'rotated_to_available_learning_objective',
      },
      learningObjectiveSelection: selection,
    };
  }

  throw new Error('No eligible Learning Objective or compatibility category is available.');
}

function upsertReviewCandidate(
  candidates: Map<string, MutableReviewCandidate>,
  input: {
    type: ReviewCandidate['type'];
    identity: string;
    display: string;
    category?: TopicCategoryKey;
    topicIdentity?: string;
    topic?: string;
    strength: number;
    reasonCode: ReviewCandidateReasonCode;
    sessionId?: string;
    seenAt: string;
  },
): void {
  const key = `${input.type}:${input.identity}`;
  const current = candidates.get(key);
  if (!current) {
    candidates.set(key, {
      type: input.type,
      identity: input.identity,
      display: input.display,
      category: input.category,
      topicIdentity: input.topicIdentity,
      topic: input.topic,
      strength: input.strength,
      reasonCodes: new Set([input.reasonCode]),
      evidenceSessionIds: new Set(input.sessionId ? [input.sessionId] : []),
      lastSeenAt: input.seenAt,
    });
    return;
  }

  current.strength += input.strength;
  current.reasonCodes.add(input.reasonCode);
  if (input.sessionId) current.evidenceSessionIds.add(input.sessionId);
  current.lastSeenAt = latestIso(current.lastSeenAt, input.seenAt);
  if (!current.category && input.category) current.category = input.category;
  if (!current.topic && input.topic) current.topic = input.topic;
  if (!current.topicIdentity && input.topicIdentity) current.topicIdentity = input.topicIdentity;
}

function candidateSort(left: ReviewCandidate, right: ReviewCandidate): number {
  const strengthDiff = right.strength - left.strength;
  if (strengthDiff !== 0) return strengthDiff;
  const dateDiff = compareIsoDesc(left.lastSeenAt, right.lastSeenAt);
  if (dateDiff !== 0) return dateDiff;
  const typeDiff = left.type.localeCompare(right.type);
  if (typeDiff !== 0) return typeDiff;
  return left.identity.localeCompare(right.identity);
}

function toReviewCandidates(candidates: Map<string, MutableReviewCandidate>): ReviewCandidate[] {
  return Array.from(candidates.values())
    .map((candidate) => ({
      ...candidate,
      strength: Math.round(candidate.strength),
      reasonCodes: Array.from(candidate.reasonCodes).sort(),
      evidenceSessionIds: Array.from(candidate.evidenceSessionIds).sort(),
    }))
    .sort(candidateSort);
}

function reviewCandidateKey(type: ReviewCandidate['type'], identity: string): string {
  return `${type}:${identity}`;
}

function sortedOldestSessions(sessions: CoverageSourceSession[]): CoverageSourceSession[] {
  return sortedNewestSessions(sessions).reverse();
}

function deriveResultReviewCandidates(input: {
  candidates: Map<string, MutableReviewCandidate>;
  sessions: CoverageSourceSession[];
  phraseIdentityToPrimary: Map<string, string>;
  phrasesByPrimary: Map<string, CoveredKeyPhrase>;
  topicsByIdentity: Map<string, CoveredTopic>;
  exerciseResults: CoverageExerciseResult[];
}): void {
  const resultsBySession = new Map<string, CoverageExerciseResult[]>();
  const unresolvedTopicSignals = new Map<
    string,
    {
      wrongExerciseSignals: Set<string>;
      correctCount: number;
      sessionIds: Set<string>;
      lastSeenAt: string;
    }
  >();
  for (const result of input.exerciseResults) {
    if (!result.exercise) continue;
    const results = resultsBySession.get(result.sessionId) ?? [];
    results.push(result);
    resultsBySession.set(result.sessionId, results);
  }

  for (const session of sortedOldestSessions(input.sessions)) {
    const sessionResults = resultsBySession.get(session.sessionId) ?? [];
    const phraseCorrectInSession = new Set<string>();
    const chronologicalSessionResults = [...sessionResults].sort((left, right) => {
      const dateDiff = dateValue(left.createdAt) - dateValue(right.createdAt);
      if (dateDiff !== 0) return dateDiff;
      return (
        (left.orderIndex ?? Number.MAX_SAFE_INTEGER) - (right.orderIndex ?? Number.MAX_SAFE_INTEGER)
      );
    });

    for (const result of chronologicalSessionResults) {
      if (!result.exercise) continue;
      const resultSeenAt = result.createdAt || sessionSortDate(session);
      const exerciseKeys = getPhraseIdentityKeys(result.exercise);
      const primaryIdentity = exerciseKeys
        .map((key) => input.phraseIdentityToPrimary.get(key))
        .find((key): key is string => Boolean(key));
      if (!primaryIdentity) continue;

      const phrase = input.phrasesByPrimary.get(primaryIdentity) ?? null;
      if (result.isCorrect) {
        input.candidates.delete(reviewCandidateKey('key_phrase', primaryIdentity));
        phraseCorrectInSession.add(primaryIdentity);
        continue;
      }

      const hasEarlierCorrectResult = phraseCorrectInSession.has(primaryIdentity);
      upsertReviewCandidate(input.candidates, {
        type: 'key_phrase',
        identity: primaryIdentity,
        display: phrase?.display ?? phraseDisplay(result.exercise),
        category: phrase?.category,
        topic: phrase?.topic,
        topicIdentity: phrase?.topicIdentity,
        strength: hasEarlierCorrectResult ? 6 : 7,
        reasonCode: hasEarlierCorrectResult ? 'mixed_exercise_result' : 'wrong_exercise_result',
        sessionId: session.sessionId,
        seenAt: resultSeenAt,
      });
    }

    const topicIdentity = normalizeTopicIdentity(session.meta.topic);
    const topic = topicIdentity ? input.topicsByIdentity.get(topicIdentity) : undefined;
    if (topicIdentity && topic) {
      if (session.meta.accuracy === 100) {
        input.candidates.delete(reviewCandidateKey('lesson_topic', topicIdentity));
        unresolvedTopicSignals.delete(topicIdentity);
      } else {
        const wrongExerciseIds = new Set(
          sessionResults.filter((result) => !result.isCorrect).map((result) => result.exerciseId),
        );
        if (wrongExerciseIds.size > 0) {
          const currentSignals = unresolvedTopicSignals.get(topicIdentity) ?? {
            wrongExerciseSignals: new Set<string>(),
            correctCount: 0,
            sessionIds: new Set<string>(),
            lastSeenAt: sessionSortDate(session),
          };
          for (const exerciseId of wrongExerciseIds) {
            currentSignals.wrongExerciseSignals.add(`${session.sessionId}:${exerciseId}`);
          }
          currentSignals.correctCount += sessionResults.filter((result) => result.isCorrect).length;
          currentSignals.sessionIds.add(session.sessionId);
          currentSignals.lastSeenAt = sessionResults.reduce(
            (latest, result) => latestIso(latest, result.createdAt || sessionSortDate(session)),
            currentSignals.lastSeenAt,
          );
          unresolvedTopicSignals.set(topicIdentity, currentSignals);
        }

        const topicSignals = unresolvedTopicSignals.get(topicIdentity);
        if (topicSignals && topicSignals.wrongExerciseSignals.size >= 2) {
          const reasonCode: ReviewCandidateReasonCode =
            topicSignals.correctCount > 0 ? 'mixed_exercise_result' : 'wrong_exercise_result';
          upsertReviewCandidate(input.candidates, {
            type: 'lesson_topic',
            identity: topicIdentity,
            display: topic.topic,
            category: topic.category,
            topic: topic.topic,
            topicIdentity,
            strength: topicSignals.correctCount > 0 ? 4 : 5,
            reasonCode,
            sessionId: session.sessionId,
            seenAt: topicSignals.lastSeenAt,
          });
          const candidate = input.candidates.get(reviewCandidateKey('lesson_topic', topicIdentity));
          for (const sessionId of topicSignals.sessionIds) {
            candidate?.evidenceSessionIds.add(sessionId);
          }
        }
      }
    }

    for (const intent of session.meta.reviewIntents ?? []) {
      if (intent.type === 'key_phrase') {
        const phrase = Array.from(input.phrasesByPrimary.values()).find(
          (candidate) =>
            candidate.primaryIdentity === intent.identity ||
            candidate.identities.includes(intent.identity),
        );
        if (!phrase) continue;
        upsertReviewCandidate(input.candidates, {
          type: 'key_phrase',
          identity: phrase.primaryIdentity,
          display: phrase.display,
          category: phrase.category,
          topic: phrase.topic,
          topicIdentity: phrase.topicIdentity,
          strength: 8,
          reasonCode: 'structured_review_intent',
          sessionId: session.sessionId,
          seenAt: sessionSortDate(session),
        });
        continue;
      }

      const intentTopic = input.topicsByIdentity.get(intent.identity);
      if (!intentTopic) continue;
      upsertReviewCandidate(input.candidates, {
        type: 'lesson_topic',
        identity: intentTopic.identity,
        display: intentTopic.topic,
        category: intentTopic.category,
        topic: intentTopic.topic,
        topicIdentity: intentTopic.identity,
        strength: 8,
        reasonCode: 'structured_review_intent',
        sessionId: session.sessionId,
        seenAt: sessionSortDate(session),
      });
    }
  }
}

function buildPromptSnapshot(input: {
  source: CoverageEvidence['source'];
  categoryRotation: CategoryRotationEvidence;
  learningObjectiveSelection: LearningObjectiveSelection;
  coveredCategories: CoveredCategory[];
  coveredTopics: CoveredTopic[];
  coveredKeyPhrases: CoveredKeyPhrase[];
  reviewCandidates: ReviewCandidate[];
}): CompactCoverageEvidence {
  return {
    source: input.source,
    categoryRotation: input.categoryRotation,
    learningObjectiveSelection: {
      ...input.learningObjectiveSelection,
      reviewCandidate: input.learningObjectiveSelection.reviewCandidate
        ? promptReviewCandidate(input.learningObjectiveSelection.reviewCandidate)
        : null,
    },
    categoryCoverage: input.coveredCategories.map((category) => ({
      category: category.category,
      count: category.count,
      lastSeenAt: category.lastSeenAt,
    })),
    avoidTopics: input.coveredTopics.slice(0, MAX_PROMPT_AVOID_TOPICS).map((topic) => ({
      identity: truncatePromptField(topic.identity),
      topic: truncatePromptField(topic.topic),
      category: topic.category,
      count: topic.count,
      lastSeenAt: topic.lastSeenAt,
    })),
    avoidKeyPhrases: input.coveredKeyPhrases
      .slice(0, MAX_PROMPT_AVOID_KEY_PHRASES)
      .map((phrase) => ({
        primaryIdentity: truncatePromptField(phrase.primaryIdentity),
        identities: phrase.identities.map(truncatePromptField),
        display: truncatePromptField(phrase.display),
        category: phrase.category,
        topic: truncateOptionalPromptField(phrase.topic),
        count: phrase.count,
        lastSeenAt: phrase.lastSeenAt,
      })),
    reviewCandidates: input.reviewCandidates
      .slice(0, MAX_PROMPT_REVIEW_CANDIDATES)
      .map(promptReviewCandidate),
  };
}

function truncatePromptField(value: string): string {
  const normalized = compactWhitespace(value);
  if (normalized.length <= MAX_PROMPT_FIELD_LENGTH) return normalized;
  return `${normalized.slice(0, MAX_PROMPT_FIELD_LENGTH - 1)}…`;
}

function truncateOptionalPromptField(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const truncated = truncatePromptField(value);
  return truncated.length > 0 ? truncated : undefined;
}

function promptReviewCandidate(candidate: ReviewCandidate): ReviewCandidate {
  return {
    ...candidate,
    identity: truncatePromptField(candidate.identity),
    display: truncatePromptField(candidate.display),
    topicIdentity: truncateOptionalPromptField(candidate.topicIdentity),
    topic: truncateOptionalPromptField(candidate.topic),
  };
}

export function buildCoverageEvidence(input: {
  sessions: CoverageSourceSession[];
  totalCompletedAiSessionCount?: number;
  ignoredCompletedAiSessionCount?: number;
  exerciseResults?: CoverageExerciseResult[];
}): CoverageEvidence {
  const sessions = sortedNewestSessions(input.sessions);
  const categories = new Map<TopicCategoryKey, MutableCategory>();
  const learningObjectives = new Map<string, MutableLearningObjective>();
  const topics = new Map<string, MutableTopic>();
  const phrases = new Map<string, MutablePhrase>();
  const phraseIdentityToPrimary = new Map<string, string>();

  for (const session of sessions) {
    const seenAt = sessionSortDate(session);
    const category = isTopicCategoryKey(session.meta.category) ? session.meta.category : undefined;
    if (category) addCategory(categories, category, session.sessionId, seenAt);

    const topicIdentity = normalizeTopicIdentity(session.meta.topic);
    if (topicIdentity) {
      addTopic(topics, {
        identity: topicIdentity,
        topic: session.meta.topic,
        category,
        sessionId: session.sessionId,
        seenAt,
      });
    }

    const learningObjective = session.meta.learningObjectiveId
      ? getLearningObjective(session.meta.learningObjectiveId)
      : null;
    if (learningObjective && learningObjective.category === category) {
      addLearningObjective(learningObjectives, {
        id: learningObjective.id,
        category: learningObjective.category,
        topicIdentity: topicIdentity ?? undefined,
        sessionId: session.sessionId,
        seenAt,
      });
    }

    for (const phrase of sourcePhraseItems(session.meta)) {
      const keys = getPhraseIdentityKeys(phrase);
      if (keys.length === 0) continue;
      addPhrase(phrases, phraseIdentityToPrimary, {
        phrase,
        keys,
        category,
        topic: session.meta.topic,
        topicIdentity: topicIdentity ?? undefined,
        sessionId: session.sessionId,
        seenAt,
      });
    }
  }

  const coveredCategories = toCoveredCategories(categories);
  const coveredLearningObjectives = toCoveredLearningObjectives(learningObjectives);
  const coveredTopics = toCoveredTopics(topics);
  const coveredKeyPhrases = toCoveredPhrases(phrases);
  const candidates = new Map<string, MutableReviewCandidate>();
  const topicsByIdentity = new Map(coveredTopics.map((topic) => [topic.identity, topic]));
  const phrasesByPrimary = new Map(
    coveredKeyPhrases.map((phrase) => [phrase.primaryIdentity, phrase]),
  );

  deriveResultReviewCandidates({
    candidates,
    sessions,
    phraseIdentityToPrimary,
    phrasesByPrimary,
    topicsByIdentity,
    exerciseResults: input.exerciseResults ?? [],
  });

  const reviewCandidates = toReviewCandidates(candidates);
  const initialCategoryRotation = selectCategory({ sessions, categories, reviewCandidates });
  const { categoryRotation, learningObjectiveSelection } = selectLearningObjective({
    categoryRotation: initialCategoryRotation,
    coveredLearningObjectives,
    reviewCandidates,
  });
  const totalCompletedAiSessions = input.totalCompletedAiSessionCount ?? sessions.length;
  const ignoredCompletedAiSessions =
    input.ignoredCompletedAiSessionCount ?? Math.max(0, totalCompletedAiSessions - sessions.length);
  const source = {
    totalCompletedAiSessions,
    parseableCompletedAiSessions: sessions.length,
    ignoredCompletedAiSessions,
  };

  return {
    source,
    categoryRotation,
    learningObjectiveSelection,
    coveredCategories,
    coveredLearningObjectives,
    coveredTopics,
    coveredKeyPhrases,
    reviewCandidates,
    promptSnapshot: buildPromptSnapshot({
      source,
      categoryRotation,
      learningObjectiveSelection,
      coveredCategories,
      coveredTopics,
      coveredKeyPhrases,
      reviewCandidates,
    }),
  };
}

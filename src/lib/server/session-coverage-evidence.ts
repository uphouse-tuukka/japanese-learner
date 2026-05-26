import {
  TOPIC_CATEGORY_KEYS,
  isTopicCategoryKey,
  type TopicCategoryKey,
} from '$lib/server/topic-categories';
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
  | 'handoff_note_mention'
  | 'weakness_mention'
  | 'learning_journal_mention'
  | 'low_accuracy_boost';

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

export type CompactCoverageEvidence = {
  source: CoverageEvidence['source'];
  categoryRotation: CategoryRotationEvidence;
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
  coveredCategories: CoveredCategory[];
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

function mentionsPhraseIdentity(text: string, identity: string): boolean {
  const separatorIndex = identity.indexOf(':');
  if (separatorIndex < 0) return false;
  const kind = identity.slice(0, separatorIndex);
  const value = identity.slice(separatorIndex + 1);
  if (!value) return false;

  if (kind === 'ja') return normalizeJapanese(text).includes(value);
  if (kind === 'romaji') return containsTokenSequence(normalizeLatin(text), value);
  return containsTokenSequence(normalizeLooseIdentity(text), value);
}

function mentionsPhrase(text: string, phrase: CoveredKeyPhrase): boolean {
  return phrase.identities.some((identity) => mentionsPhraseIdentity(text, identity));
}

function mentionsTopic(text: string, topic: CoveredTopic): boolean {
  const normalizedText = normalizeTopicIdentity(text);
  return Boolean(normalizedText && containsTokenSequence(normalizedText, topic.identity));
}

function containsTokenSequence(text: string, sequence: string): boolean {
  const textTokens = text.split(' ').filter(Boolean);
  const sequenceTokens = sequence.split(' ').filter(Boolean);
  if (sequenceTokens.length === 0 || textTokens.length < sequenceTokens.length) return false;

  return textTokens.some((_, index) =>
    sequenceTokens.every((token, tokenIndex) => textTokens[index + tokenIndex] === token),
  );
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

function deriveResultReviewCandidates(input: {
  candidates: Map<string, MutableReviewCandidate>;
  sessionsById: Map<string, CoverageSourceSession>;
  phraseIdentityToPrimary: Map<string, string>;
  phrasesByPrimary: Map<string, CoveredKeyPhrase>;
  topicsByIdentity: Map<string, CoveredTopic>;
  exerciseResults: CoverageExerciseResult[];
}): void {
  const phraseEvidence = new Map<
    string,
    {
      correctCount: number;
      wrongCount: number;
      sessionIds: Set<string>;
      lastSeenAt: string;
      phrase: CoveredKeyPhrase | null;
      display: string;
      category?: TopicCategoryKey;
      topic?: string;
      topicIdentity?: string;
    }
  >();
  const topicEvidence = new Map<
    string,
    {
      correctCount: number;
      wrongCount: number;
      sessionIds: Set<string>;
      lastSeenAt: string;
      topic: CoveredTopic;
    }
  >();

  for (const result of input.exerciseResults) {
    const session = input.sessionsById.get(result.sessionId);
    if (!session || !result.exercise) continue;

    const resultSeenAt = result.createdAt || sessionSortDate(session);
    const exerciseKeys = getPhraseIdentityKeys(result.exercise);
    const primaryIdentity =
      exerciseKeys
        .map((key) => input.phraseIdentityToPrimary.get(key))
        .find((key): key is string => Boolean(key)) ?? exerciseKeys[0];

    if (primaryIdentity) {
      const phrase = input.phrasesByPrimary.get(primaryIdentity) ?? null;
      const current = phraseEvidence.get(primaryIdentity) ?? {
        correctCount: 0,
        wrongCount: 0,
        sessionIds: new Set<string>(),
        lastSeenAt: resultSeenAt,
        phrase,
        display: phrase?.display ?? phraseDisplay(result.exercise),
        category: phrase?.category,
        topic: phrase?.topic,
        topicIdentity: phrase?.topicIdentity,
      };
      if (result.isCorrect) current.correctCount += 1;
      else current.wrongCount += 1;
      current.sessionIds.add(result.sessionId);
      current.lastSeenAt = latestIso(current.lastSeenAt, resultSeenAt);
      phraseEvidence.set(primaryIdentity, current);
    }

    const topicIdentity = normalizeTopicIdentity(session.meta.topic);
    if (topicIdentity) {
      const topic = input.topicsByIdentity.get(topicIdentity);
      if (topic) {
        const current = topicEvidence.get(topicIdentity) ?? {
          correctCount: 0,
          wrongCount: 0,
          sessionIds: new Set<string>(),
          lastSeenAt: resultSeenAt,
          topic,
        };
        if (result.isCorrect) current.correctCount += 1;
        else current.wrongCount += 1;
        current.sessionIds.add(result.sessionId);
        current.lastSeenAt = latestIso(current.lastSeenAt, resultSeenAt);
        topicEvidence.set(topicIdentity, current);
      }
    }
  }

  for (const [identity, evidence] of phraseEvidence.entries()) {
    if (evidence.wrongCount <= 0) continue;
    const reasonCode: ReviewCandidateReasonCode =
      evidence.correctCount > 0 ? 'mixed_exercise_result' : 'wrong_exercise_result';
    upsertReviewCandidate(input.candidates, {
      type: 'key_phrase',
      identity,
      display: evidence.display,
      category: evidence.category,
      topic: evidence.topic,
      topicIdentity: evidence.topicIdentity,
      strength: evidence.correctCount > 0 ? 6 : 7,
      reasonCode,
      sessionId: Array.from(evidence.sessionIds)[0],
      seenAt: evidence.lastSeenAt,
    });
  }

  for (const [identity, evidence] of topicEvidence.entries()) {
    if (evidence.wrongCount <= 0) continue;
    const reasonCode: ReviewCandidateReasonCode =
      evidence.correctCount > 0 ? 'mixed_exercise_result' : 'wrong_exercise_result';
    upsertReviewCandidate(input.candidates, {
      type: 'lesson_topic',
      identity,
      display: evidence.topic.topic,
      category: evidence.topic.category,
      topic: evidence.topic.topic,
      topicIdentity: identity,
      strength: evidence.correctCount > 0 ? 4 : 5,
      reasonCode,
      sessionId: Array.from(evidence.sessionIds)[0],
      seenAt: evidence.lastSeenAt,
    });
  }
}

function deriveMentionReviewCandidates(input: {
  candidates: Map<string, MutableReviewCandidate>;
  sessions: CoverageSourceSession[];
  coveredPhrases: CoveredKeyPhrase[];
  coveredTopics: CoveredTopic[];
  learningJournal?: string | null;
}): void {
  for (const session of input.sessions) {
    const seenAt = sessionSortDate(session);
    const weaknessText = [...session.meta.weaknesses].join(' ');
    const handoffText = [
      ...(session.meta.handoffNotes ?? []),
      ...(session.meta.nextSteps ?? []),
    ].join(' ');

    if (weaknessText) {
      for (const phrase of input.coveredPhrases) {
        if (!mentionsPhrase(weaknessText, phrase)) continue;
        upsertReviewCandidate(input.candidates, {
          type: 'key_phrase',
          identity: phrase.primaryIdentity,
          display: phrase.display,
          category: phrase.category,
          topic: phrase.topic,
          topicIdentity: phrase.topicIdentity,
          strength: 3,
          reasonCode: 'weakness_mention',
          sessionId: session.sessionId,
          seenAt,
        });
      }
      for (const topic of input.coveredTopics) {
        if (!mentionsTopic(weaknessText, topic)) continue;
        upsertReviewCandidate(input.candidates, {
          type: 'lesson_topic',
          identity: topic.identity,
          display: topic.topic,
          category: topic.category,
          topic: topic.topic,
          topicIdentity: topic.identity,
          strength: 3,
          reasonCode: 'weakness_mention',
          sessionId: session.sessionId,
          seenAt,
        });
      }
    }

    if (handoffText) {
      for (const phrase of input.coveredPhrases) {
        if (!mentionsPhrase(handoffText, phrase)) continue;
        upsertReviewCandidate(input.candidates, {
          type: 'key_phrase',
          identity: phrase.primaryIdentity,
          display: phrase.display,
          category: phrase.category,
          topic: phrase.topic,
          topicIdentity: phrase.topicIdentity,
          strength: 4,
          reasonCode: 'handoff_note_mention',
          sessionId: session.sessionId,
          seenAt,
        });
      }
      for (const topic of input.coveredTopics) {
        if (!mentionsTopic(handoffText, topic)) continue;
        upsertReviewCandidate(input.candidates, {
          type: 'lesson_topic',
          identity: topic.identity,
          display: topic.topic,
          category: topic.category,
          topic: topic.topic,
          topicIdentity: topic.identity,
          strength: 4,
          reasonCode: 'handoff_note_mention',
          sessionId: session.sessionId,
          seenAt,
        });
      }
    }

    if (session.meta.accuracy < 50) {
      for (const candidate of input.candidates.values()) {
        if (!candidate.evidenceSessionIds.has(session.sessionId)) continue;
        candidate.strength += 1;
        candidate.reasonCodes.add('low_accuracy_boost');
      }
    }
  }

  const journal = compactWhitespace(input.learningJournal ?? '');
  if (!journal) return;

  for (const phrase of input.coveredPhrases) {
    if (!mentionsPhrase(journal, phrase)) continue;
    upsertReviewCandidate(input.candidates, {
      type: 'key_phrase',
      identity: phrase.primaryIdentity,
      display: phrase.display,
      category: phrase.category,
      topic: phrase.topic,
      topicIdentity: phrase.topicIdentity,
      strength: 2,
      reasonCode: 'learning_journal_mention',
      seenAt: phrase.lastSeenAt,
    });
  }

  for (const topic of input.coveredTopics) {
    if (!mentionsTopic(journal, topic)) continue;
    upsertReviewCandidate(input.candidates, {
      type: 'lesson_topic',
      identity: topic.identity,
      display: topic.topic,
      category: topic.category,
      topic: topic.topic,
      topicIdentity: topic.identity,
      strength: 2,
      reasonCode: 'learning_journal_mention',
      seenAt: topic.lastSeenAt,
    });
  }
}

function buildPromptSnapshot(input: {
  source: CoverageEvidence['source'];
  categoryRotation: CategoryRotationEvidence;
  coveredCategories: CoveredCategory[];
  coveredTopics: CoveredTopic[];
  coveredKeyPhrases: CoveredKeyPhrase[];
  reviewCandidates: ReviewCandidate[];
}): CompactCoverageEvidence {
  return {
    source: input.source,
    categoryRotation: input.categoryRotation,
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
  learningJournal?: string | null;
}): CoverageEvidence {
  const sessions = sortedNewestSessions(input.sessions);
  const categories = new Map<TopicCategoryKey, MutableCategory>();
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
  const coveredTopics = toCoveredTopics(topics);
  const coveredKeyPhrases = toCoveredPhrases(phrases);
  const candidates = new Map<string, MutableReviewCandidate>();
  const sessionsById = new Map(sessions.map((session) => [session.sessionId, session]));
  const topicsByIdentity = new Map(coveredTopics.map((topic) => [topic.identity, topic]));
  const phrasesByPrimary = new Map(
    coveredKeyPhrases.map((phrase) => [phrase.primaryIdentity, phrase]),
  );

  deriveResultReviewCandidates({
    candidates,
    sessionsById,
    phraseIdentityToPrimary,
    phrasesByPrimary,
    topicsByIdentity,
    exerciseResults: input.exerciseResults ?? [],
  });
  deriveMentionReviewCandidates({
    candidates,
    sessions,
    coveredPhrases: coveredKeyPhrases,
    coveredTopics,
    learningJournal: input.learningJournal,
  });

  const reviewCandidates = toReviewCandidates(candidates);
  const categoryRotation = selectCategory({ sessions, categories, reviewCandidates });
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
    coveredCategories,
    coveredTopics,
    coveredKeyPhrases,
    reviewCandidates,
    promptSnapshot: buildPromptSnapshot({
      source,
      categoryRotation,
      coveredCategories,
      coveredTopics,
      coveredKeyPhrases,
      reviewCandidates,
    }),
  };
}

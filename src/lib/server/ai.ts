import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import type {
Exercise,
ExerciseType,
SessionPlan,
SessionSummary,
TokenUsage,
User,
UserLevel
} from '$lib/types';

const SESSION_MODEL = 'gpt-4o-mini';

let openaiClient: OpenAI | null = null;

function nowIso(): string {
return new Date().toISOString();
}

function getOpenAiClient(): OpenAI {
const apiKey = config.openai.apiKey.trim();
if (!apiKey) {
throw new Error('[ai] Missing OpenAI API key in config.openai.apiKey');
}
if (!openaiClient) {
openaiClient = new OpenAI({ apiKey });
}
return openaiClient;
}

function assertString(value: unknown, fieldName: string): string {
if (typeof value !== 'string' || !value.trim()) {
throw new Error(`[ai] Invalid field "${fieldName}" in model output`);
}
return value.trim();
}

function toStringArray(value: unknown, fieldName: string, fallback: string[] = []): string[] {
if (!Array.isArray(value)) {
return fallback;
}
const normalized = value.map((item) => String(item).trim()).filter(Boolean);
if (normalized.length === 0 && fallback.length === 0) {
throw new Error(`[ai] Invalid field "${fieldName}". Expected non-empty string array.`);
}
return normalized.length > 0 ? normalized : fallback;
}

function toDifficulty(value: unknown): 1 | 2 | 3 | 4 | 5 {
const parsed = Number(value);
if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 5) {
return Math.round(parsed) as 1 | 2 | 3 | 4 | 5;
}
return 1;
}

function isExerciseType(value: unknown): value is ExerciseType {
return (
value === 'multiple_choice' ||
value === 'translation' ||
value === 'fill_blank' ||
value === 'reorder' ||
value === 'reading'
);
}

function normalizeExercise(raw: unknown, index: number): Exercise {
if (!raw || typeof raw !== 'object') {
throw new Error(`[ai] Exercise at index ${index} is not an object`);
}

const row = raw as Record<string, unknown>;
const typeRaw = row.type;
if (!isExerciseType(typeRaw)) {
throw new Error(`[ai] Exercise at index ${index} has unsupported type: ${String(typeRaw)}`);
}

const base = {
id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : `ai-${randomUUID()}`,
type: typeRaw,
title: assertString(row.title, 'title'),
japanese: assertString(row.japanese, 'japanese'),
romaji: assertString(row.romaji, 'romaji'),
englishContext: assertString(row.englishContext, 'englishContext'),
tags: toStringArray(row.tags, 'tags', ['travel', 'beginner']),
difficulty: toDifficulty(row.difficulty)
};

if (typeRaw === 'multiple_choice') {
const choices = toStringArray(row.choices, 'choices');
return {
...base,
type: 'multiple_choice',
question: assertString(row.question, 'question'),
choices,
correctAnswer: assertString(row.correctAnswer, 'correctAnswer'),
explanation: typeof row.explanation === 'string' ? row.explanation : undefined
};
}

if (typeRaw === 'translation') {
const direction = row.direction === 'ja_to_en' ? 'ja_to_en' : 'en_to_ja';
const expectedAnswer = assertString(row.expectedAnswer, 'expectedAnswer');
return {
...base,
type: 'translation',
direction,
prompt: assertString(row.prompt, 'prompt'),
expectedAnswer,
expectedRomaji: typeof row.expectedRomaji === 'string' ? row.expectedRomaji : undefined,
acceptedAnswers: toStringArray(row.acceptedAnswers, 'acceptedAnswers', [expectedAnswer])
};
}

if (typeRaw === 'fill_blank') {
return {
...base,
type: 'fill_blank',
sentence: assertString(row.sentence, 'sentence'),
sentenceRomaji: assertString(row.sentenceRomaji, 'sentenceRomaji'),
sentenceEnglish: assertString(row.sentenceEnglish, 'sentenceEnglish'),
blank: assertString(row.blank, 'blank'),
answer: assertString(row.answer, 'answer'),
answerRomaji: assertString(row.answerRomaji, 'answerRomaji')
};
}

if (typeRaw === 'reorder') {
const tokens = toStringArray(row.tokens, 'tokens');
return {
...base,
type: 'reorder',
prompt: assertString(row.prompt, 'prompt'),
tokens,
correctOrder: toStringArray(row.correctOrder, 'correctOrder', tokens)
};
}

return {
...base,
type: 'reading',
passage: assertString(row.passage, 'passage'),
passageRomaji: assertString(row.passageRomaji, 'passageRomaji'),
passageEnglish: assertString(row.passageEnglish, 'passageEnglish'),
question: assertString(row.question, 'question'),
answer: assertString(row.answer, 'answer')
};
}

function ensureExerciseCount(exercises: Exercise[]): Exercise[] {
if (exercises.length < 8 || exercises.length > 12) {
throw new Error(`[ai] Invalid exercise count ${exercises.length}. Expected between 8 and 12.`);
}
return exercises;
}

function getUsageFromResponse(response: OpenAI.Responses.Response): Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'> {
const usage = response.usage;
const tokensIn = Number(usage?.input_tokens ?? 0);
const tokensOut = Number(usage?.output_tokens ?? 0);
const tokensTotal = Number(usage?.total_tokens ?? tokensIn + tokensOut);
return {
model: SESSION_MODEL,
tokensIn,
tokensOut,
tokensTotal
};
}

function fallbackUser(userId: string): User {
return {
id: userId,
name: 'Learner',
level: 'beginner' as UserLevel,
createdAt: nowIso(),
updatedAt: nowIso(),
lastActiveAt: null
};
}

type SessionPlanInput =
| {
user: User;
previousSessions?: Array<Pick<SessionPlan, 'metadata'>>;
exerciseCount?: number;
focus?: string;
  }
| {
userId: string;
mode?: 'ai' | 'practice';
exerciseCount?: number;
focus?: string;
  };

function resolveSessionInput(input: SessionPlanInput): {
user: User;
previousSessions: Array<Pick<SessionPlan, 'metadata'>>;
targetExerciseCount: number;
focus: string;
} {
if ('user' in input) {
return {
user: input.user,
previousSessions: input.previousSessions ?? [],
targetExerciseCount: Math.min(12, Math.max(8, Math.round(input.exerciseCount ?? 10))),
focus: input.focus ?? 'travel_japanese'
};
}

return {
user: fallbackUser(input.userId),
previousSessions: [],
targetExerciseCount: Math.min(12, Math.max(8, Math.round(input.exerciseCount ?? 10))),
focus: input.focus ?? 'travel_japanese'
};
}

export async function generateSessionPlan(input: SessionPlanInput): Promise<SessionPlan> {
const client = getOpenAiClient();
const resolved = resolveSessionInput(input);
const priorTopics = resolved.previousSessions
.map((session) => String(session.metadata.focus ?? '').trim())
.filter(Boolean)
.slice(-5);

const response = await client.responses.create({
model: SESSION_MODEL,
temperature: 0.3,
input: [
{
role: 'system',
content:
'You are a Japanese teacher creating one travel-focused beginner practice session. Return a JSON object only. Include a varied mix of multiple_choice, translation, fill_blank, reorder, and reading exercises. Every exercise must include Japanese text, romaji, and English context. Difficulty should progress from easy to medium.'
},
{
role: 'user',
content: JSON.stringify({
user: resolved.user,
priorTopics,
constraints: {
domain: 'travel_japanese',
minExercises: 8,
maxExercises: 12,
targetExercises: resolved.targetExerciseCount,
level: resolved.user.level,
requireRomaji: true,
requireEnglishContext: true,
focus: resolved.focus
}
})
}
],
text: {
format: {
type: 'json_object'
}
}
});

if (!response.output_text) {
throw new Error('[ai] OpenAI response did not include output_text for session generation');
}

const parsed = JSON.parse(response.output_text) as {
focus: string;
selectionStrategy: string;
exercises: unknown[];
};

const exercises = ensureExerciseCount(parsed.exercises.map((exercise, index) => normalizeExercise(exercise, index)));
const tokenUsage = getUsageFromResponse(response);

const plan: SessionPlan = {
id: `session-${randomUUID()}`,
userId: resolved.user.id,
mode: 'ai',
createdAt: nowIso(),
model: tokenUsage.model,
exercises,
tokenUsage,
metadata: {
focus: assertString(parsed.focus, 'focus'),
exerciseCount: exercises.length,
selectionStrategy: assertString(parsed.selectionStrategy, 'selectionStrategy'),
domain: 'travel_japanese',
progression: 'romaji_supported_beginner_progression'
}
};

console.info('[ai] generated session plan', {
sessionId: plan.id,
userId: plan.userId,
exerciseCount: plan.exercises.length,
tokensTotal: tokenUsage.tokensTotal
});

return plan;
}

export const createSessionPlan = generateSessionPlan;
export const buildSessionPlan = generateSessionPlan;

export async function generateSessionSummary(input: {
sessionId: string;
userId: string;
results: Array<{ exerciseId: string; answerText: string; isCorrect: boolean }>;
accuracy?: number;
focus?: string;
}): Promise<{
summary: SessionSummary;
tokenUsage: Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'>;
}> {
const client = getOpenAiClient();
const accuracy =
typeof input.accuracy === 'number' && Number.isFinite(input.accuracy)
? input.accuracy
: input.results.length === 0
? 0
: Math.round((input.results.filter((row) => row.isCorrect).length / input.results.length) * 100);

const response = await client.responses.create({
model: SESSION_MODEL,
temperature: 0.2,
input: [
{
role: 'system',
content:
'You are a concise Japanese tutor. Return a JSON object only with summary, strengths, weaknesses, and nextSteps arrays for a beginner travel learner.'
},
{
role: 'user',
content: JSON.stringify({
sessionId: input.sessionId,
userId: input.userId,
focus: input.focus ?? 'travel_japanese',
accuracy,
results: input.results
})
}
],
text: {
format: {
type: 'json_object'
}
}
});

if (!response.output_text) {
throw new Error('[ai] OpenAI response did not include output_text for summary generation');
}

const parsed = JSON.parse(response.output_text) as {
summary: string;
strengths: string[];
weaknesses: string[];
nextSteps: string[];
};

const summary: SessionSummary = {
sessionId: input.sessionId,
userId: input.userId,
summary: assertString(parsed.summary, 'summary'),
strengths: toStringArray(parsed.strengths, 'strengths'),
weaknesses: toStringArray(parsed.weaknesses, 'weaknesses'),
nextSteps: toStringArray(parsed.nextSteps, 'nextSteps'),
accuracy,
generatedAt: nowIso()
};

const tokenUsage = getUsageFromResponse(response);
console.info('[ai] generated session summary', {
sessionId: input.sessionId,
tokensTotal: tokenUsage.tokensTotal
});

return {
summary,
tokenUsage
};
}

export const summarizeSession = generateSessionSummary;
export const createSessionSummary = generateSessionSummary;

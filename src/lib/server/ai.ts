import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { config } from '$lib/config';
import type {
Exercise,
ExerciseType,
KeyPhrase,
Lesson,
SessionPlan,
SessionSummary,
TokenUsage,
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

function isExerciseType(value: unknown): value is ExerciseType {
return (
value === 'multiple_choice' ||
value === 'translation' ||
value === 'fill_blank' ||
value === 'reorder' ||
value === 'reading' ||
value === 'listening'
);
}

function normalizeDifficulty(value: unknown, level: UserLevel): 1 | 2 | 3 | 4 | 5 {
const parsed = Number(value);
const rounded = Number.isFinite(parsed) ? Math.round(parsed) : 1;
if (level === 'absolute_beginner') {
return Math.min(2, Math.max(1, rounded)) as 1 | 2;
}
if (level === 'beginner') {
return Math.min(3, Math.max(1, rounded)) as 1 | 2 | 3;
}
return Math.min(4, Math.max(2, rounded)) as 2 | 3 | 4;
}

function normalizeKeyPhrase(raw: unknown, index: number): KeyPhrase {
if (!raw || typeof raw !== 'object') {
throw new Error(`[ai] keyPhrases[${index}] is not an object`);
}
const row = raw as Record<string, unknown>;
return {
japanese: assertString(row.japanese, `keyPhrases[${index}].japanese`),
romaji: assertString(row.romaji, `keyPhrases[${index}].romaji`),
english: assertString(row.english, `keyPhrases[${index}].english`),
usage: assertString(row.usage, `keyPhrases[${index}].usage`)
};
}

function normalizeLesson(raw: unknown): Lesson {
if (!raw || typeof raw !== 'object') {
throw new Error('[ai] Missing lesson object in model output');
}
const row = raw as Record<string, unknown>;
const keyPhrasesRaw = Array.isArray(row.keyPhrases) ? row.keyPhrases : [];
if (keyPhrasesRaw.length < 3 || keyPhrasesRaw.length > 5) {
throw new Error('[ai] lesson.keyPhrases must contain 3-5 entries');
}
return {
topic: assertString(row.topic, 'lesson.topic'),
explanation: assertString(row.explanation, 'lesson.explanation'),
culturalNote: assertString(row.culturalNote, 'lesson.culturalNote'),
keyPhrases: keyPhrasesRaw.map((phrase, index) => normalizeKeyPhrase(phrase, index))
};
}

function normalizeExercise(raw: unknown, index: number, level: UserLevel): Exercise {
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
tags: toStringArray(row.tags, 'tags', ['travel', 'teaching-session']),
difficulty: normalizeDifficulty(row.difficulty, level)
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

if (typeRaw === 'reading') {
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

return {
...base,
type: 'listening',
prompt: assertString(row.prompt, 'prompt'),
audioText: assertString(row.audioText, 'audioText'),
choices: toStringArray(row.choices, 'choices'),
correctAnswer: assertString(row.correctAnswer, 'correctAnswer')
};
}

function validateExerciseSet(exercises: Exercise[], level: UserLevel): Exercise[] {
if (exercises.length === 0) {
throw new Error('[ai] exercises must not be empty');
}

if (level === 'absolute_beginner') {
for (const exercise of exercises) {
if (exercise.type !== 'multiple_choice' && exercise.type !== 'translation') {
throw new Error(`[ai] Invalid exercise type for absolute beginner: ${exercise.type}`);
}
if (exercise.difficulty > 2) {
throw new Error('[ai] absolute_beginner received difficulty above 2');
}
if (exercise.type === 'translation' && exercise.direction !== 'ja_to_en') {
throw new Error('[ai] absolute_beginner translation direction must be ja_to_en');
}
}
}

if (level === 'beginner') {
for (const exercise of exercises) {
if (exercise.type === 'fill_blank' || exercise.type === 'reorder' || exercise.type === 'reading') {
throw new Error(`[ai] Invalid exercise type for beginner: ${exercise.type}`);
}
if (exercise.difficulty > 3) {
throw new Error('[ai] beginner received difficulty above 3');
}
}
}

if (level === 'lower_intermediate') {
for (const exercise of exercises) {
if (exercise.difficulty < 2 || exercise.difficulty > 4) {
throw new Error('[ai] lower_intermediate difficulty must be between 2 and 4');
}
}
}

return exercises;
}

function getUsageFromResponse(response: OpenAI.Responses.Response): {
model: string;
input: number;
output: number;
total: number;
} {
const usage = response.usage;
const input = Number(usage?.input_tokens ?? 0);
const output = Number(usage?.output_tokens ?? 0);
const total = Number(usage?.total_tokens ?? input + output);
return {
model: SESSION_MODEL,
input,
output,
total
};
}

function levelInstructions(level: UserLevel): string {
if (level === 'absolute_beginner') {
return [
'User level is absolute_beginner.',
'All lesson and exercise text must include romaji support.',
'Teach only very basic travel survival Japanese (greetings, numbers, transport, restaurant basics).',
'Allowed exercise types: multiple_choice and translation only.',
'Translation must always be direction ja_to_en. Never require typing Japanese.',
'Do not generate fill_blank, reorder, reading, or listening.',
'Difficulty must be only 1-2.'
].join(' ');
}

if (level === 'beginner') {
return [
'User level is beginner.',
'Start introducing hiragana alongside romaji in a gentle way.',
'Allowed exercise types: multiple_choice, translation, listening.',
'Translation can be both directions, but en_to_ja answers must accept romaji.',
'Difficulty must be 1-3.'
].join(' ');
}

return [
'User level is lower_intermediate.',
'All exercise types are allowed.',
'Difficulty must be 2-4.',
'Use practical travel context and polite, natural phrasing.'
].join(' ');
}

export async function generateSessionPlan(input: {
userId: string;
userName: string;
userLevel: UserLevel;
exerciseCount?: number;
sessionHistory?: Array<{
date: string;
topic: string;
accuracy: number;
strengths: string[];
weaknesses: string[];
nextSteps: string[];
keyPhrases: string[];
}>;
recentAccuracy?: number;
coveredTopics?: string[];
totalSessionCount?: number;
performanceInsights?: {
overallAccuracy: number;
weakExerciseIds: string[];
strongExerciseIds: string[];
recentWrongAnswers: string[];
};
}): Promise<SessionPlan> {
const client = getOpenAiClient();
const targetExerciseCount = Math.min(12, Math.max(4, Math.round(input.exerciseCount ?? 6)));
const sessionHistory = (input.sessionHistory ?? []).slice(0, 10);
const recentTopics = sessionHistory
.slice(0, 5)
.map((item) => item.topic.trim())
.filter(Boolean);

const response = await client.responses.create({
model: SESSION_MODEL,
temperature: 0.3,
input: [
{
role: 'system',
content: [
'You are a Japanese tutor that adapts each session based on learner history.',
'Output valid JSON only with top-level keys: lesson, exercises, focus.',
'Tutor evolution rules:',
'1) Never repeat a lesson topic from the learner\'s last 5 sessions.',
'2) Address recent weaknesses directly in lesson explanation and exercise selection.',
'3) Follow prior next-steps whenever possible.',
'4) Progression threshold: if recentAccuracy > 80, increase challenge slightly; if recentAccuracy < 50, reinforce fundamentals.',
'5) Staged curriculum by totalSessionCount: 0-10 travel survival only; 10-20 include daily life; 20+ broaden to practical social and work-adjacent situations.',
'6) Personalize by connecting to previously studied phrases and mistakes.',
'7) Vary exercise types inside one session (within level constraints).',
'The session must teach one topic first, then quiz only what was taught.',
'Lesson must include topic, explanation, culturalNote, keyPhrases (3-5 items).',
'Each key phrase item must include japanese, romaji, english, usage.',
'Every exercise must include japanese, romaji, englishContext, tags, difficulty, and type-specific fields.',
levelInstructions(input.userLevel),
'For absolute_beginner, never ask learner to type Japanese script.',
'Use practical language the learner can immediately use in Japan.',
`Do not use these recent topics: ${recentTopics.length ? recentTopics.join(', ') : 'none'}.`,
'Keep content coherent around the same lesson topic.'
].join(' ')
},
{
role: 'user',
content: JSON.stringify({
user: {
id: input.userId,
name: input.userName,
level: input.userLevel,
sessionHistory,
recentAccuracy: input.recentAccuracy ?? null,
coveredTopics: input.coveredTopics ?? [],
totalSessionCount: input.totalSessionCount ?? 0,
performanceInsights: input.performanceInsights ?? {
overallAccuracy: 0,
weakExerciseIds: [],
strongExerciseIds: [],
recentWrongAnswers: []
}
},
targetExerciseCount,
requiredOutputExample: {
lesson: {
topic: 'Ordering at a restaurant',
explanation: 'When eating out in Japan, you can use a few polite phrases...',
culturalNote: "In Japan, you don't tip. Service is included.",
keyPhrases: [
{
japanese: 'すみません',
romaji: 'sumimasen',
english: 'Excuse me',
usage: "Use to politely call the server's attention"
}
]
},
exercises: [],
focus: 'restaurant_ordering'
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
throw new Error('[ai] OpenAI response missing output_text for session generation');
}

const parsed = JSON.parse(response.output_text) as {
lesson: unknown;
exercises: unknown[];
focus: string;
};

const lesson = normalizeLesson(parsed.lesson);
const exercises = validateExerciseSet(
(parsed.exercises ?? []).map((exercise, index) => normalizeExercise(exercise, index, input.userLevel)),
input.userLevel
);

if (exercises.length !== targetExerciseCount) {
throw new Error(`[ai] expected ${targetExerciseCount} exercises, received ${exercises.length}`);
}

const usage = getUsageFromResponse(response);

const plan: SessionPlan = {
id: `session-${randomUUID()}`,
userId: input.userId,
mode: 'ai',
createdAt: nowIso(),
model: usage.model,
lesson,
exercises,
tokenUsage: {
input: usage.input,
output: usage.output
},
metadata: {
focus: assertString(parsed.focus, 'focus'),
exerciseCount: exercises.length,
teachingFlow: 'lesson_then_quiz',
userLevel: input.userLevel
}
};

console.info('[ai] generated session plan', {
sessionId: plan.id,
userId: plan.userId,
exerciseCount: plan.exercises.length,
focus: plan.metadata.focus,
tokensInput: usage.input,
tokensOutput: usage.output
});

return plan;
}

export async function generateSessionSummary(input: {
sessionId: string;
userId: string;
userLevel: UserLevel;
lessonTopic?: string;
exercises: Exercise[];
results: Array<{ exerciseId: string; answerText: string; isCorrect: boolean }>;
}): Promise<{
summary: SessionSummary;
tokenUsage: Pick<TokenUsage, 'model' | 'tokensIn' | 'tokensOut' | 'tokensTotal'>;
}> {
const client = getOpenAiClient();
const accuracy =
input.results.length === 0
? 0
: Math.round((input.results.filter((row) => row.isCorrect).length / input.results.length) * 100);

const exercisesById = new Map<string, Exercise>();
for (const exercise of input.exercises) {
exercisesById.set(exercise.id, exercise);
}

const detailedResults = input.results.map((result) => {
const exercise = exercisesById.get(result.exerciseId);
return {
exerciseId: result.exerciseId,
type: exercise?.type ?? 'unknown',
title: exercise?.title ?? 'Unknown exercise',
prompt: exercise?.englishContext ?? '',
answerText: result.answerText,
isCorrect: result.isCorrect
};
});

const response = await client.responses.create({
model: SESSION_MODEL,
temperature: 0.2,
input: [
{
role: 'system',
content: [
'You are a Japanese tutor giving specific, actionable feedback based on actual answers.',
'Return JSON only with keys: summary, strengths, weaknesses, nextSteps.',
'Reference exact phrases, exact topics, and concrete mistakes from the completed exercises.',
'Make recommendations for the next session topic and include difficulty guidance (whether to reinforce or increase challenge).',
'Keep feedback encouraging, practical, and travel-focused.'
].join(' ')
},
{
role: 'user',
content: JSON.stringify({
sessionId: input.sessionId,
userId: input.userId,
userLevel: input.userLevel,
lessonTopic: input.lessonTopic ?? 'travel_japanese',
accuracy,
exercises: input.exercises.map((exercise) => ({
id: exercise.id,
type: exercise.type,
title: exercise.title,
japanese: exercise.japanese,
romaji: exercise.romaji,
englishContext: exercise.englishContext,
difficulty: exercise.difficulty
})),
results: detailedResults
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
throw new Error('[ai] OpenAI response missing output_text for summary generation');
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
strengths: toStringArray(parsed.strengths, 'strengths', ['You completed the session.']),
weaknesses: toStringArray(parsed.weaknesses, 'weaknesses', ['Review any missed phrases once more.']),
nextSteps: toStringArray(parsed.nextSteps, 'nextSteps', ['Complete one more short session tomorrow.']),
accuracy,
generatedAt: nowIso()
};

const usage = getUsageFromResponse(response);
console.info('[ai] generated session summary', {
sessionId: input.sessionId,
tokensInput: usage.input,
tokensOutput: usage.output
});

return {
summary,
tokenUsage: {
model: usage.model,
tokensIn: usage.input,
tokensOut: usage.output,
tokensTotal: usage.total
}
};
}

export const createSessionPlan = generateSessionPlan;
export const buildSessionPlan = generateSessionPlan;
export const summarizeSession = generateSessionSummary;
export const createSessionSummary = generateSessionSummary;

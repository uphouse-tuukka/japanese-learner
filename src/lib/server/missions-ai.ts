import OpenAI from 'openai';
import { config } from './config';
import { recordTokenUsage } from './db';
import type { Mission, MissionChoice, MissionMode, MissionTurn } from '../types';

const SESSION_MODEL = 'gpt-5.4';
const EVALUATION_MODEL = 'gpt-4.1';

let openaiClient: OpenAI | null = null;

type MissionTokenUsage = {
  model: string;
  input: number;
  output: number;
  total: number;
};

function getOpenAiClient(): OpenAI {
  const apiKey = config.openai.apiKey.trim();
  if (!apiKey) {
    throw new Error('[missions-ai] Missing OpenAI API key in config.openai.apiKey');
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`[missions-ai] Invalid field "${fieldName}" in model output`);
  }
  return value.trim();
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseModelJson(text: string): Record<string, unknown> {
  const candidate = text.trim();

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Continue to fallback parsing.
  }

  const fencedMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim()) as Record<string, unknown>;
    } catch {
      // Continue to fallback parsing.
    }
  }

  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = candidate.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice) as Record<string, unknown>;
    } catch {
      // Continue to hard failure.
    }
  }

  throw new Error('[missions-ai] Could not parse JSON from model response');
}

function getUsageFromResponse(response: OpenAI.Responses.Response): MissionTokenUsage {
  const usage = response.usage;
  const input = Number(usage?.input_tokens ?? 0);
  const output = Number(usage?.output_tokens ?? 0);
  const total = Number(usage?.total_tokens ?? input + output);

  return {
    model: SESSION_MODEL,
    input,
    output,
    total,
  };
}

function getResponseText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }
  throw new Error('[missions-ai] OpenAI response missing output_text');
}

function normalizeChoice(raw: unknown): MissionChoice | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const japanese = typeof row.japanese === 'string' ? row.japanese.trim() : '';
  const romaji = typeof row.romaji === 'string' ? row.romaji.trim() : '';
  const english = typeof row.english === 'string' ? row.english.trim() : '';

  if (!japanese || !romaji || !english) {
    return null;
  }

  return {
    japanese,
    romaji,
    english,
    isCorrect: row.isCorrect === true,
  };
}

function normalizeInputText(value: string): string {
  return value.trim().toLowerCase();
}

function buildGenerateSystemPrompt(input: {
  mission: Mission;
  mode: MissionMode;
  turnNumber: number;
  totalTurns: number;
  userLevel?: string;
  journalExcerpt?: string;
}): string {
  const modeInstruction =
    input.mode === 'practice'
      ? "Also generate 3 multiple choice response options for the user. One should be the best/correct response, two should be plausible but less ideal alternatives. For each option, provide: japanese, romaji, english meaning, and whether it's the correct one."
      : 'Also generate a contextual hint in English that helps the user understand what you said, without translating directly. The hint should guide them on what kind of response is expected.';

  return [
    'You are playing a character in a Japanese language learning mission.',
    '',
    input.mission.scenarioPrompt,
    '',
    'CRITICAL RULES:',
    '1. You MUST speak ONLY in Japanese with romaji in parentheses. NO English translations.',
    '2. Keep responses natural and conversational — 1-2 sentences per turn.',
    `3. This is turn ${input.turnNumber} of ${input.totalTurns}.`,
    "4. Respond to the user's previous message naturally, then advance the conversation.",
    '',
    modeInstruction,
    input.userLevel?.trim()
      ? `The user's level is ${input.userLevel.trim()}. Adjust vocabulary complexity accordingly.`
      : '',
    input.journalExcerpt?.trim()
      ? `Learner journal excerpt for calibration:\n${input.journalExcerpt.trim()}`
      : '',
    '',
    'Respond in JSON format:',
    '{',
    '  "npcDialogue": {',
    '    "japanese": "...",',
    '    "romaji": "..."',
    '  },',
    '  "sceneDescription": "..." (only for turn 1, a 1-2 sentence atmospheric scene-setter in English),',
    '  "characterName": "..." (Japanese name for the character, e.g., "ウェイター"),',
    '  "characterEmoji": "..." (emoji for the character role),',
    '  "choices": [...] (only in practice mode — array of 3 objects with japanese, romaji, english, isCorrect),',
    '  "hint": "..." (only in immersion mode — contextual English hint)',
    '}',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildGenerateUserPayload(input: {
  mission: Mission;
  mode: MissionMode;
  turnNumber: number;
  totalTurns: number;
  conversationHistory: MissionTurn[];
}): string {
  return JSON.stringify(
    {
      mission: {
        id: input.mission.id,
        title: input.mission.title,
        category: input.mission.category,
        difficulty: input.mission.difficulty,
      },
      mode: input.mode,
      turnNumber: input.turnNumber,
      totalTurns: input.totalTurns,
      conversationHistory: input.conversationHistory,
      required: {
        turnOneNeedsSceneDescription: input.turnNumber === 1,
        practiceRequiresExactlyThreeChoices: input.mode === 'practice',
      },
    },
    null,
    2,
  );
}

export async function generateMissionTurn(input: {
  mission: Mission;
  mode: MissionMode;
  turnNumber: number;
  totalTurns: number;
  conversationHistory: MissionTurn[];
  userLevel?: string;
  journalExcerpt?: string;
}): Promise<{
  turn: MissionTurn;
  sceneDescription?: string;
  characterName: string;
  characterEmoji: string;
  tokenUsage: { model: string; input: number; output: number; total: number };
}> {
  const client = getOpenAiClient();

  const response = await client.responses.create({
    model: SESSION_MODEL,
    temperature: 0.4,
    input: [
      {
        role: 'system',
        content: buildGenerateSystemPrompt({
          mission: input.mission,
          mode: input.mode,
          turnNumber: input.turnNumber,
          totalTurns: input.totalTurns,
          userLevel: input.userLevel,
          journalExcerpt: input.journalExcerpt,
        }),
      },
      {
        role: 'user',
        content: buildGenerateUserPayload({
          mission: input.mission,
          mode: input.mode,
          turnNumber: input.turnNumber,
          totalTurns: input.totalTurns,
          conversationHistory: input.conversationHistory,
        }),
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const usage = getUsageFromResponse(response);

  try {
    const parsed = parseModelJson(getResponseText(response));

    const npcDialogue = toRecord(parsed.npcDialogue);
    const japanese = assertString(npcDialogue.japanese, 'npcDialogue.japanese');
    const romaji = assertString(npcDialogue.romaji, 'npcDialogue.romaji');

    let choices: MissionChoice[] | undefined;
    if (input.mode === 'practice') {
      const rawChoices = Array.isArray(parsed.choices) ? parsed.choices : [];
      const normalized = rawChoices
        .map((choice) => normalizeChoice(choice))
        .filter((choice): choice is MissionChoice => choice !== null)
        .slice(0, 3);

      if (normalized.length === 3) {
        choices = normalized;
      }
    }

    const hint =
      input.mode === 'immersion' && typeof parsed.hint === 'string' && parsed.hint.trim()
        ? parsed.hint.trim()
        : undefined;

    const turn: MissionTurn = {
      turnNumber: input.turnNumber,
      npcDialogue: {
        japanese,
        romaji,
      },
      userResponse: null,
      feedback: null,
      choices,
      hint,
    };

    return {
      turn,
      sceneDescription:
        input.turnNumber === 1 && typeof parsed.sceneDescription === 'string'
          ? parsed.sceneDescription.trim() || undefined
          : undefined,
      characterName:
        typeof parsed.characterName === 'string' && parsed.characterName.trim()
          ? parsed.characterName.trim()
          : '店員',
      characterEmoji:
        typeof parsed.characterEmoji === 'string' && parsed.characterEmoji.trim()
          ? parsed.characterEmoji.trim()
          : '💬',
      tokenUsage: usage,
    };
  } catch (error) {
    console.warn('[missions-ai] Failed to parse generateMissionTurn response, using fallback', {
      missionId: input.mission.id,
      mode: input.mode,
      turnNumber: input.turnNumber,
      error: error instanceof Error ? error.message : String(error),
    });

    const fallbackTurn: MissionTurn = {
      turnNumber: input.turnNumber,
      npcDialogue: {
        japanese: '少々お待ちください。 (shoushou omachi kudasai.)',
        romaji: 'shoushou omachi kudasai.',
      },
      userResponse: null,
      feedback: null,
      choices:
        input.mode === 'practice'
          ? [
              {
                japanese: 'はい、わかりました。',
                romaji: 'hai, wakarimashita.',
                english: 'Yes, understood.',
                isCorrect: true,
              },
              {
                japanese: 'いいえ、だいじょうぶです。',
                romaji: 'iie, daijoubu desu.',
                english: 'No, I am fine.',
                isCorrect: false,
              },
              {
                japanese: 'もう一度お願いします。',
                romaji: 'mou ichido onegaishimasu.',
                english: 'Please say that again.',
                isCorrect: false,
              },
            ]
          : undefined,
      hint:
        input.mode === 'immersion'
          ? 'Respond politely and acknowledge what the other person just said.'
          : undefined,
    };

    return {
      turn: fallbackTurn,
      sceneDescription:
        input.turnNumber === 1
          ? 'You find yourself in a lively setting in Japan, and the conversation begins politely.'
          : undefined,
      characterName: '店員',
      characterEmoji: '💬',
      tokenUsage: usage,
    };
  }
}

function buildEvaluationSystemPrompt(input: {
  mission: Mission;
  mode: MissionMode;
  turnNumber: number;
  npcDialogue: { japanese: string; romaji: string };
  userResponse: string;
  expectedContext: string;
  conversationHistory: MissionTurn[];
}): string {
  return [
    "You are evaluating a Japanese language learner's response in a roleplay conversation.",
    '',
    `Mission: ${input.mission.title}`,
    `Mode: ${input.mode}`,
    `Turn number: ${input.turnNumber}`,
    `The NPC said: ${input.npcDialogue.japanese} (${input.npcDialogue.romaji})`,
    `The user responded: ${input.userResponse}`,
    `Conversation context: ${input.expectedContext}`,
    '',
    'Evaluate the response:',
    '1. Is it contextually appropriate? (Does it make sense as a response?)',
    '2. Is it grammatically acceptable? (Minor errors OK for learners)',
    '3. Is it natural? (Would a Japanese person say this?)',
    '',
    'Respond in JSON:',
    '{',
    '  "correct": true/false (true if contextually appropriate, even with minor grammar issues),',
    '  "message": "..." (brief encouraging feedback in English, e.g., "Good! Natural response." or "Almost! Try using ください when ordering."),',
    '  "naturalPhrasing": true/false (true only if the phrasing sounds natural to a native speaker)',
    '}',
  ].join('\n');
}

function evaluatePracticeResponse(
  userResponse: string,
  conversationHistory: MissionTurn[],
): {
  correct: boolean;
  naturalPhrasing: boolean;
  message: string;
} {
  const latestTurn = conversationHistory[conversationHistory.length - 1];
  const choices = latestTurn?.choices ?? [];

  if (choices.length === 0) {
    return {
      correct: false,
      naturalPhrasing: false,
      message: 'Answer received, but no choices were found to validate this turn.',
    };
  }

  const normalizedUserResponse = normalizeInputText(userResponse);

  let selectedChoice: MissionChoice | null = null;

  if (/^[1-3]$/.test(normalizedUserResponse)) {
    const index = Number(normalizedUserResponse) - 1;
    selectedChoice = choices[index] ?? null;
  }

  if (!selectedChoice) {
    selectedChoice =
      choices.find((choice) => {
        return (
          normalizeInputText(choice.japanese) === normalizedUserResponse ||
          normalizeInputText(choice.romaji) === normalizedUserResponse ||
          normalizeInputText(choice.english) === normalizedUserResponse
        );
      }) ?? null;
  }

  if (!selectedChoice) {
    return {
      correct: false,
      naturalPhrasing: false,
      message:
        'I could not match that response to the provided options. Please select one of the choices.',
    };
  }

  if (selectedChoice.isCorrect) {
    return {
      correct: true,
      naturalPhrasing: true,
      message: 'Great choice! That response fits the context well.',
    };
  }

  return {
    correct: false,
    naturalPhrasing: false,
    message:
      'Nice try — that option is understandable, but there is a better response for this context.',
  };
}

export async function evaluateUserResponse(input: {
  mission: Mission;
  mode: MissionMode;
  turnNumber: number;
  npcDialogue: { japanese: string; romaji: string };
  userResponse: string;
  expectedContext: string;
  conversationHistory: MissionTurn[];
}): Promise<{
  correct: boolean;
  message: string;
  naturalPhrasing: boolean;
  tokenUsage: { model: string; input: number; output: number; total: number };
}> {
  if (input.mode === 'practice') {
    const evaluation = evaluatePracticeResponse(input.userResponse, input.conversationHistory);
    return {
      ...evaluation,
      tokenUsage: {
        model: EVALUATION_MODEL,
        input: 0,
        output: 0,
        total: 0,
      },
    };
  }

  const client = getOpenAiClient();

  const response = await client.responses.create({
    model: EVALUATION_MODEL,
    temperature: 0.2,
    input: [
      {
        role: 'system',
        content: buildEvaluationSystemPrompt({
          mission: input.mission,
          mode: input.mode,
          turnNumber: input.turnNumber,
          npcDialogue: input.npcDialogue,
          userResponse: input.userResponse,
          expectedContext: input.expectedContext,
          conversationHistory: input.conversationHistory,
        }),
      },
      {
        role: 'user',
        content: JSON.stringify(
          {
            npcDialogue: input.npcDialogue,
            userResponse: input.userResponse,
            expectedContext: input.expectedContext,
            conversationHistory: input.conversationHistory,
          },
          null,
          2,
        ),
      },
    ],
    text: {
      format: {
        type: 'json_object',
      },
    },
  });

  const usage = getUsageFromResponse(response);

  try {
    const parsed = parseModelJson(getResponseText(response));

    const correct = parsed.correct === true;
    const naturalPhrasing = parsed.naturalPhrasing === true;
    const message =
      typeof parsed.message === 'string' && parsed.message.trim()
        ? parsed.message.trim()
        : correct
          ? 'Good response!'
          : 'Almost there — try a slightly more natural phrasing.';

    return {
      correct,
      message,
      naturalPhrasing,
      tokenUsage: usage,
    };
  } catch (error) {
    console.warn('[missions-ai] Failed to parse evaluateUserResponse output, using fallback', {
      missionId: input.mission.id,
      turnNumber: input.turnNumber,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      correct: false,
      message:
        'Thanks! I could not fully evaluate that response. Please try again with a short, polite reply.',
      naturalPhrasing: false,
      tokenUsage: usage,
    };
  }
}

async function trackMissionTokenUsage(
  userId: string,
  missionId: string,
  usage: { model: string; input: number; output: number; total: number },
): Promise<void> {
  void missionId;
  await recordTokenUsage({
    userId,
    sessionId: null,
    model: usage.model,
    tokensIn: usage.input,
    tokensOut: usage.output,
  });
}

export const recordMissionTokenUsage = trackMissionTokenUsage;

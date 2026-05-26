import { TOPIC_CATEGORIES as TOPIC_CATEGORY_DEFINITIONS } from '$lib/server/topic-categories';
import type { ExerciseType, SessionMiniLesson, UserLevel } from '$lib/types';

export {
  TOPIC_CATEGORIES,
  TOPIC_CATEGORY_KEYS,
  type TopicCategoryKey,
} from '$lib/server/topic-categories';

export const LEVEL_RULES: Record<
  UserLevel,
  {
    minDifficulty: 1 | 2 | 3;
    maxDifficulty: 2 | 3 | 4 | 5;
    allowedTypes: ExerciseType[];
    translationDirections: Array<'ja_to_en' | 'en_to_ja'>;
  }
> = {
  absolute_beginner: {
    minDifficulty: 1,
    maxDifficulty: 2,
    allowedTypes: ['multiple_choice', 'translation'],
    translationDirections: ['ja_to_en'],
  },
  beginner: {
    minDifficulty: 1,
    maxDifficulty: 3,
    allowedTypes: ['multiple_choice', 'translation', 'listening'],
    translationDirections: ['ja_to_en'],
  },
  elementary: {
    minDifficulty: 1,
    maxDifficulty: 3,
    allowedTypes: ['multiple_choice', 'translation', 'listening', 'fill_blank', 'speaking'],
    translationDirections: ['ja_to_en'],
  },
  pre_intermediate: {
    minDifficulty: 2,
    maxDifficulty: 4,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
      'speaking',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  intermediate: {
    minDifficulty: 2,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
      'speaking',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  upper_intermediate: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
      'speaking',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  advanced: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
      'speaking',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
  ready_for_japan: {
    minDifficulty: 3,
    maxDifficulty: 5,
    allowedTypes: [
      'multiple_choice',
      'translation',
      'listening',
      'fill_blank',
      'reorder',
      'reading',
      'speaking',
    ],
    translationDirections: ['ja_to_en', 'en_to_ja'],
  },
};

const TRANSLATION_FIELD_REQUIREMENT_SUFFIX =
  'prompt (the text to translate), expectedAnswer (the correct translation), acceptedAnswers (string array of alternative correct answers).';

const EXERCISE_FIELD_REQUIREMENTS: Record<NonTranslationExerciseType, string> = {
  multiple_choice:
    '- multiple_choice: question, choices (string array of 4 options), correctAnswer (must match one choice), explanation (optional). For multiple_choice exercises: the "japanese" and "romaji" fields are metadata only and will NOT be shown to the user. They should contain the key phrase being tested for internal tracking. The "question" field must be completely self-contained — if it references Japanese text, include it inline in the question string. The question field is the ONLY text shown to the user above the choices, so it must be completely self-contained. CRITICAL for multiple_choice: the question must NEVER require looking at japanese/romaji fields to make sense. The question + choices must form a complete, self-contained quiz on their own. For multiple_choice exercises, every choice that contains Japanese must include romaji in parentheses. Example choice: "すみません (sumimasen)". This applies to ALL choices in the array and to correctAnswer. For multiple_choice exercises, the question MUST provide clear context and be self-contained so the learner understands exactly what is being tested. Use one of these patterns: (a) ask what a Japanese phrase means, e.g. "What does [phrase] mean?"; (b) present a real-life scenario and ask which phrase fits, e.g. "You are at a restaurant and want to get the waiter\'s attention. What would you say?"; (c) ask the learner to identify the correct translation/usage, e.g. "Which phrase means [English meaning]?". NEVER write a vague question like "Which phrase is most appropriate?" without a scenario. IMPORTANT: The \'japanese\' and \'romaji\' fields are metadata only and are NOT displayed to the user. The \'question\' field is the ONLY text shown above the choices, so it must be completely self-contained. If the question references a Japanese phrase (e.g. \'What does すみません (sumimasen) mean?\'), include it directly in the question string.',
  fill_blank:
    '- fill_blank: sentence, sentenceRomaji, sentenceEnglish, blank, answer, answerRomaji.',
  reorder: '- reorder: prompt, tokens (string array), correctOrder (string array).',
  reading: '- reading: passage, passageRomaji, passageEnglish, question, answer.',
  listening:
    '- listening: prompt, audioText, choices (string array), correctAnswer (must match one choice). For listening exercises, prompt must be short English-only instruction, e.g. "Listen and choose the correct meaning". Do NOT include Japanese text or romaji in prompt.',
  speaking:
    '- speaking: prompt, responseKind ("situational_response" or "translation_en_to_ja"), expectedAnswer (Japanese script only), expectedRomaji (romanization only), acceptedAnswers (string array of natural Japanese-script alternatives; romaji alternatives allowed only for future typed fallback), rubric (semantic correctness criteria), maxRecordingSeconds (optional, 5-20). The prompt must tell the learner to speak Japanese. Grade semantic correctness, not exact wording.',
};

const PUBLIC_CHALLENGE_ALLOWED_TYPES: ExerciseType[] = [
  'multiple_choice',
  'translation',
  'listening',
];

export type AiPromptMessage = {
  role: 'system' | 'user';
  content: string;
};

export type SessionPlanPromptHistoryEntry = {
  date: string;
  category?: string;
  topic: string;
  accuracy: number;
  strengths: string[];
  weaknesses: string[];
  nextSteps?: string[];
  handoffNotes?: string[];
  culturalNote?: string;
  miniLesson?: SessionMiniLesson | null;
  keyPhrases: string[];
};

export type SessionPlanPromptInput = {
  userId: string;
  userName: string;
  userLevel: UserLevel;
  japaneseWritingEnabled?: boolean;
  exerciseCount?: number;
  sessionHistory?: SessionPlanPromptHistoryEntry[];
  recentAccuracy?: number;
  coveredTopics?: string[];
  categoryRotation?: {
    currentCategory: string | null;
    currentCategoryStreak: number;
    recentCategories: Array<{ category: string; sessionsAgo: number }>;
    neverVisited: string[];
  };
  totalSessionCount?: number;
  performanceInsights?: {
    overallAccuracy: number;
    weakExerciseIds: string[];
    strongExerciseIds: string[];
    recentWrongAnswers: string[];
  };
};

export type SessionPlanPrompt = {
  messages: AiPromptMessage[];
  targetExerciseCount: number;
  sessionHistory: SessionPlanPromptHistoryEntry[];
};

export type PublicChallengePromptInput = {
  scenario: string;
  scenarioLabel: string;
  targetExerciseCount: number;
};

export type PublicChallengePrompt = {
  messages: AiPromptMessage[];
  targetExerciseCount: number;
};

function compactSingleLine(value: string, maxLength = 160): string {
  const singleLine = value.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function levelInstructions(level: UserLevel): string {
  if (level === 'absolute_beginner')
    return [
      'User level is absolute_beginner.',
      'Use only basic travel survival Japanese with clear romaji support.',
      'Allowed exercise types: multiple_choice and translation.',
      'Difficulty range is strictly 1-2.',
      'Translation direction must be ja_to_en only.',
      'Do not require Japanese typing.',
      'Speaking exercises are not allowed.',
    ].join(' ');

  if (level === 'beginner')
    return [
      'User level is beginner.',
      'Introduce hiragana gently while keeping romaji support.',
      'Allowed exercise types: multiple_choice, translation, listening.',
      'Difficulty range is strictly 1-3.',
      'Translation direction must be ja_to_en only.',
      'Speaking exercises are not allowed.',
    ].join(' ');

  if (level === 'elementary')
    return [
      'User level is elementary.',
      'Allowed exercise types: multiple_choice, translation, listening, fill_blank, speaking.',
      'Difficulty range is strictly 1-3.',
      'Translation direction must be ja_to_en only.',
      'Elementary speaking exercises must use responseKind="situational_response" only.',
    ].join(' ');

  if (level === 'pre_intermediate')
    return [
      'User level is pre_intermediate.',
      'All exercise types are allowed, including speaking.',
      'Speaking exercises may use responseKind="situational_response" or "translation_en_to_ja".',
      'Difficulty range is strictly 2-4.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'intermediate')
    return [
      'User level is intermediate.',
      'All exercise types are allowed, including speaking.',
      'Speaking exercises may use responseKind="situational_response" or "translation_en_to_ja".',
      'Difficulty range is strictly 2-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'upper_intermediate')
    return [
      'User level is upper_intermediate.',
      'All exercise types are allowed, including speaking.',
      'Speaking exercises may use responseKind="situational_response" or "translation_en_to_ja".',
      'Difficulty range is strictly 3-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  if (level === 'advanced')
    return [
      'User level is advanced.',
      'All exercise types are allowed, including speaking.',
      'Speaking exercises may use responseKind="situational_response" or "translation_en_to_ja".',
      'Difficulty range is strictly 3-5.',
      'Translation can be ja_to_en or en_to_ja.',
    ].join(' ');

  return [
    'User level is ready_for_japan.',
    'All exercise types are allowed, including speaking.',
    'Speaking exercises may use responseKind="situational_response" or "translation_en_to_ja".',
    'Difficulty range is strictly 3-5.',
    'Translation can be ja_to_en or en_to_ja.',
  ].join(' ');
}

type TranslationDirection = 'ja_to_en' | 'en_to_ja';
type NonTranslationExerciseType = Exclude<ExerciseType, 'translation'>;

function formatTranslationDirections(directions: TranslationDirection[]): string {
  const quotedDirections = directions.map((direction) => `"${direction}"`);
  return quotedDirections.length === 1
    ? `${quotedDirections[0]} only`
    : quotedDirections.join(' or ');
}

function translationFieldRequirement(directions: TranslationDirection[]): string {
  return `- translation: direction (${formatTranslationDirections(directions)}), ${TRANSLATION_FIELD_REQUIREMENT_SUFFIX}`;
}

function exerciseFieldRequirement(
  type: ExerciseType,
  translationDirections: TranslationDirection[],
): string {
  if (type === 'translation') {
    return translationFieldRequirement(translationDirections);
  }
  return EXERCISE_FIELD_REQUIREMENTS[type as NonTranslationExerciseType];
}

function exerciseFieldRequirements(level: UserLevel): string[] {
  const rules = LEVEL_RULES[level];
  const requirements = rules.allowedTypes.map((type) =>
    exerciseFieldRequirement(type, rules.translationDirections),
  );
  if (level === 'absolute_beginner') {
    return [
      ...requirements,
      'For absolute_beginner, translation direction must always be "ja_to_en".',
    ];
  }
  if (level === 'beginner') {
    return [...requirements, 'For beginner, translation direction must always be "ja_to_en".'];
  }
  if (level === 'elementary') {
    return [
      ...requirements,
      'For elementary, translation direction must always be "ja_to_en".',
      'For elementary, speaking responseKind must be "situational_response" only.',
    ];
  }
  return requirements;
}

function fieldRequirementsForTypes(types: ExerciseType[]): string[] {
  return types.map((type) => exerciseFieldRequirement(type, ['ja_to_en']));
}

export function buildSessionPlanPrompt(input: SessionPlanPromptInput): SessionPlanPrompt {
  const japaneseWritingEnabled = input.japaneseWritingEnabled === true;
  const allowWritingExercises =
    japaneseWritingEnabled &&
    (input.userLevel === 'elementary' ||
      input.userLevel === 'pre_intermediate' ||
      input.userLevel === 'intermediate' ||
      input.userLevel === 'upper_intermediate' ||
      input.userLevel === 'advanced' ||
      input.userLevel === 'ready_for_japan');
  const targetExerciseCount = Math.min(12, Math.max(4, Math.round(input.exerciseCount ?? 6)));
  const sessionHistory = (input.sessionHistory ?? []).slice(0, 10);
  const categoryList = TOPIC_CATEGORY_DEFINITIONS.map(
    (c) => `${c.key}: ${c.label} (${c.examples})`,
  ).join('; ');
  const categoryRotation = input.categoryRotation;
  const categoryContext = categoryRotation
    ? [
        'TOPIC CATEGORY ROTATION:',
        `Available categories: ${categoryList}.`,
        `Current category streak: ${categoryRotation.currentCategory ? `"${categoryRotation.currentCategory}" × ${categoryRotation.currentCategoryStreak} session(s)` : 'none (first session)'}. `,
        categoryRotation.currentCategoryStreak >= 3
          ? `MUST switch to a different category — 3 sessions reached.`
          : categoryRotation.currentCategoryStreak >= 2
            ? `You may continue this category one more time or switch — your choice based on learner progress.`
            : `Continue this category to build depth, or switch if the learner seems ready.`,
        categoryRotation.recentCategories.length > 0
          ? `Recently visited (do NOT return to these yet): ${categoryRotation.recentCategories.map((c) => c.category).join(', ')}.`
          : '',
        categoryRotation.neverVisited.length > 0
          ? `Never visited yet (good candidates): ${categoryRotation.neverVisited.join(', ')}.`
          : '',
        'For early sessions, prefer starting with greetings_basics, then food_dining, transport, shopping as a natural learning flow.',
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  const priorNotes = sessionHistory
    .slice(0, 3)
    .map((s) => {
      const parts: string[] = [];
      if (s.weaknesses?.length) parts.push(`weak: ${s.weaknesses.join(', ')}`);
      const handoffNotes = (s.handoffNotes?.length ? s.handoffNotes : (s.nextSteps ?? [])).filter(
        (item) => typeof item === 'string' && item.trim(),
      );
      if (handoffNotes.length) parts.push(`handoff: ${handoffNotes.join(', ')}`);
      return parts.length ? `[${s.topic}] ${parts.join('; ')}` : null;
    })
    .filter(Boolean);

  const priorNotesBlock =
    priorNotes.length > 0
      ? `PRIOR SESSION HANDOFF (internal; soft guidance only):\n${priorNotes.join('\n')}`
      : '';

  const recentCulturalNotes = sessionHistory
    .filter((s) => typeof s.culturalNote === 'string' && s.culturalNote.trim())
    .slice(0, 4)
    .map((s) => {
      const categoryLabel = (s.category ?? 'uncategorized').trim() || 'uncategorized';
      const topicLabel = s.topic.trim() || 'unknown topic';
      const note = compactSingleLine(s.culturalNote ?? '');
      return `- [${categoryLabel} / ${topicLabel}] "${note}"`;
    });

  const recentCulturalNotesBlock =
    recentCulturalNotes.length > 0
      ? [
          'RECENT CULTURAL NOTES (avoid repeating these unless essential):',
          ...recentCulturalNotes,
        ].join('\n')
      : '';

  return {
    messages: [
      {
        role: 'system',
        content: [
          'You are a Japanese tutor that adapts each session based on learner history.',
          'Output valid JSON only with top-level keys: lesson, exercises, focus.',
          `Current user level: ${input.userLevel}. Apply levelInstructions() as hard constraints for allowed exercise types, difficulty range, and translation directions.`,
          '',
          categoryContext,
          '',
          priorNotesBlock,
          '',
          recentCulturalNotesBlock,
          '',
          '1) Teaching flow:',
          '- Pick a specific topic WITHIN the chosen category. Teach it first, then quiz only what was taught.',
          '- Use prior handoff notes when they fit the chosen category/topic, but do not override category rotation or force artificial continuity.',
          '- Category rotation rules above are authoritative.',
          '- If recentAccuracy > 80, increase challenge slightly; if < 50, reinforce fundamentals.',
          '- Personalize by connecting to previously studied phrases.',
          '- Avoid repeating recent cultural notes or the same micro-theme (especially repeated sumimasen politeness trivia) unless essential to the new lesson.',
          '',
          '2) Required output structure:',
          '- lesson must include: category (one of the category keys above), topic, explanation, culturalNote, keyPhrases (3-5 items).',
          '- each key phrase: japanese, romaji, english, usage.',
          '- every exercise must include: type, title, tags, difficulty, japanese, romaji, englishContext, plus type-specific fields.',
          'Exercise type-specific required fields:',
          ...exerciseFieldRequirements(input.userLevel),
          '',
          '3) Translation robustness:',
          'For every translation exercise, acceptedAnswers must include AT LEAST 3 valid English variants. Prioritize communicative intent: if a native speaker would understand the meaning correctly, include it as accepted.',
          '',
          '4) CRITICAL ROMAJI RULE: Learner-visible free-text Japanese must include romaji in parentheses. Structured fields may separate script and romaji: fields named "japanese" and speaking "expectedAnswer" must contain Japanese script only, with paired romanization in "romaji" or "expectedRomaji".',
          '',
          '5) Exercise quality:',
          '- Vary exercise types within level constraints.',
          '- Cover at least 5 distinct phrases per session; do not reuse the same phrase in more than 2 exercises.',
          '- Do NOT generate two exercises that test the same phrase in the same way. If ありがとうございます (arigatou gozaimasu) appears in one multiple_choice exercise, do not create another multiple_choice that tests the same concept for that phrase.',
          '- For multiple_choice exercises: the "japanese" and "romaji" fields are metadata only and will NOT be shown to learners. They should store the key phrase for internal tracking.',
          '- For multiple_choice exercises: the "question" field is the ONLY text shown above choices and MUST provide clear context and be self-contained. Use one of these patterns: (a) "What does [phrase] mean?"; (b) a real-life scenario asking what to say; (c) "Which phrase means [English meaning]?". If referencing Japanese text, include it directly in the question string. NEVER use a vague question like "Which phrase is most appropriate?" without a scenario.',
          '- CRITICAL for multiple_choice: the question must NEVER require looking at "japanese"/"romaji" to make sense. The question + choices must form a complete quiz on their own.',
          '- CRITICAL: The "title" field is ignored and overridden. Do NOT include the answer or any hint to the answer in the "question" field. The question must test the learner WITHOUT revealing what the correct answer is.',
          levelInstructions(input.userLevel),
          ...(allowWritingExercises
            ? [
                'Japanese writing input is enabled for this learner. You may include writing-style prompts when useful.',
              ]
            : [
                'Japanese writing input is disabled. Do not require typed Japanese script answers; microphone speaking exercises may still ask the learner to speak Japanese.',
              ]),
          'Use practical language the learner can immediately use in Japan.',
          'Keep content coherent around the chosen topic.',
        ]
          .filter(Boolean)
          .join(' '),
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
            totalSessionCount: input.totalSessionCount ?? 0,
            performanceInsights: input.performanceInsights ?? {
              overallAccuracy: 0,
              weakExerciseIds: [],
              strongExerciseIds: [],
              recentWrongAnswers: [],
            },
          },
          targetExerciseCount,
          requiredOutputExample: {
            lesson: {
              topic: 'Ordering at a restaurant',
              category: 'food_dining',
              explanation: 'When eating out in Japan, you can use a few polite phrases...',
              culturalNote: "In Japan, you don't tip. Service is included.",
              keyPhrases: [
                {
                  japanese: 'すみません',
                  romaji: 'sumimasen',
                  english: 'Excuse me',
                  usage: "Use to politely call the server's attention",
                },
              ],
            },
            exercises: [
              {
                type: 'multiple_choice',
                title: 'Choose the greeting',
                japanese: 'こんにちは',
                romaji: 'konnichiwa',
                englishContext: 'A common daytime greeting',
                tags: ['greetings'],
                difficulty: 1,
                question: 'What does こんにちは (konnichiwa) mean?',
                choices: ['Good morning', 'Good evening', 'Hello / Good afternoon', 'Goodbye'],
                correctAnswer: 'Hello / Good afternoon',
              },
              {
                type: 'translation',
                title: 'Translate the phrase',
                japanese: 'ありがとうございます',
                romaji: 'arigatou gozaimasu',
                englishContext: 'A polite expression of gratitude',
                tags: ['polite_expressions'],
                difficulty: 1,
                direction: 'ja_to_en',
                prompt: 'ありがとうございます (arigatou gozaimasu)',
                expectedAnswer: 'Thank you very much',
                acceptedAnswers: ['Thank you very much', 'Thank you'],
              },
            ],
            focus: 'restaurant_ordering',
          },
        }),
      },
    ],
    targetExerciseCount,
    sessionHistory,
  };
}

export function buildPublicChallengePrompt(
  input: PublicChallengePromptInput,
): PublicChallengePrompt {
  const targetExerciseCount = Math.max(1, Math.round(input.targetExerciseCount));

  return {
    messages: [
      {
        role: 'system',
        content: [
          'You are a Japanese tutor creating a short beginner-level travel demo lesson.',
          'Output valid JSON only with top-level keys: lesson, exercises, focus.',
          `Create a lesson about: ${input.scenarioLabel}. The lesson category MUST be '${input.scenario}'.`,
          levelInstructions('beginner'),
          'Every exercise, regardless of type, MUST include these shared fields: type, japanese, romaji, englishContext, tags, difficulty.',
          'SCRIPT FORMATTING RULE: In fields named "japanese", output Japanese script only (no inline romaji and no parentheses). Put romanization only in fields named "romaji".',
          'PUBLIC CHALLENGE MULTIPLE_CHOICE RULE: Only two patterns are allowed. Pattern 1: question is an English scenario asking what to say; all choices must be Japanese and include romaji in parentheses. Pattern 2: question includes a Japanese phrase and asks what it means; all choices must be English only.',
          'NEVER generate English-scenario + English-only choices in public challenge.',
          'Public challenge must not include speaking exercises or require microphone access.',
          `Public challenge allowed exercise types: ${PUBLIC_CHALLENGE_ALLOWED_TYPES.join(', ')}.`,
          'Exercise type-specific required fields:',
          ...fieldRequirementsForTypes(PUBLIC_CHALLENGE_ALLOWED_TYPES),
          'For public challenge, translation direction must always be "ja_to_en".',
          '',
          'For every translation exercise, acceptedAnswers must include AT LEAST 3 valid English variants. Prioritize communicative intent: if a native speaker would understand the meaning correctly, include it as accepted.',
          '',
          'CRITICAL ROMAJI RULE: In learner-visible fields, every Japanese string must include romaji in parentheses (example: こんにちは (konnichiwa)). In fields named "japanese", keep script-only text and put romanization in the paired "romaji" field.',
          '',
          'Exercise quality:',
          '- Vary exercise types within level constraints.',
          '- Cover at least 5 distinct phrases per session; do not reuse the same phrase in more than 2 exercises.',
          '- Do NOT generate two exercises that test the same phrase in the same way. If ありがとうございます (arigatou gozaimasu) appears in one multiple_choice exercise, do not create another multiple_choice that tests the same concept for that phrase.',
          '- For multiple_choice exercises: the "japanese" and "romaji" fields are metadata only and will NOT be shown to learners. They should store the key phrase for internal tracking.',
          '- For public challenge multiple_choice exercises, ONLY use one of these two patterns: (a) scenario question in English + Japanese choices with romaji; (b) Japanese phrase in the question asking for meaning + English-only choices.',
          '- For public challenge multiple_choice exercises, NEVER use English scenario question + English-only choices.',
          '- CRITICAL for multiple_choice: the question must NEVER require looking at "japanese"/"romaji" to make sense. The question + choices must form a complete quiz on their own.',
          'Use practical language the learner can immediately use in Japan.',
          'Keep content coherent around the requested scenario.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          scenario: input.scenario,
          scenarioLabel: input.scenarioLabel,
          targetExerciseCount: input.targetExerciseCount,
          requiredOutputExample: {
            lesson: {
              topic: `Example topic for ${input.scenarioLabel}`,
              category: input.scenario,
              explanation: 'Brief explanation of the topic...',
              culturalNote: 'A relevant cultural note...',
              keyPhrases: [
                {
                  japanese: 'すみません',
                  romaji: 'sumimasen',
                  english: 'Excuse me',
                  usage: 'Use to politely get attention',
                },
              ],
            },
            exercises: [
              {
                type: 'multiple_choice',
                title: 'Choose the greeting',
                japanese: 'こんにちは',
                romaji: 'konnichiwa',
                englishContext: 'A common daytime greeting',
                tags: ['greetings'],
                difficulty: 1,
                question: 'What does こんにちは (konnichiwa) mean?',
                choices: ['Good morning', 'Good evening', 'Hello / Good afternoon', 'Goodbye'],
                correctAnswer: 'Hello / Good afternoon',
              },
              {
                type: 'multiple_choice',
                title: 'Get attention politely',
                japanese: 'すみません',
                romaji: 'sumimasen',
                englishContext: 'Polite way to get someone’s attention',
                tags: ['directions', 'politeness'],
                difficulty: 1,
                question:
                  'You want to politely stop someone on the street before asking for directions. What would you say?',
                choices: [
                  'すみません (sumimasen)',
                  'ありがとう (arigatou)',
                  'さようなら (sayounara)',
                  'おはよう (ohayou)',
                ],
                correctAnswer: 'すみません (sumimasen)',
              },
            ],
            focus: input.scenario,
          },
        }),
      },
    ],
    targetExerciseCount,
  };
}

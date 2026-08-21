import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGenerateSessionPlan,
  mockGenerateSessionPlanOptions,
  mockDeleteStaleGhostSessions,
  mockGetCompletedAiExerciseResultsForUser,
  mockGetCompletedAiSessionsForUser,
  mockGetExerciseResultsForUser,
  mockGetSessionsForUser,
  mockCreateSessionRecord,
  mockAttachExercisesToSession,
  mockCheckBudget,
  mockRecordUsageEvent,
  mockGetUser,
} = vi.hoisted(() => ({
  mockGenerateSessionPlan: vi.fn(),
  mockGenerateSessionPlanOptions: vi.fn(),
  mockDeleteStaleGhostSessions: vi.fn(),
  mockGetCompletedAiExerciseResultsForUser: vi.fn(),
  mockGetCompletedAiSessionsForUser: vi.fn(),
  mockGetExerciseResultsForUser: vi.fn(),
  mockGetSessionsForUser: vi.fn(),
  mockCreateSessionRecord: vi.fn(),
  mockAttachExercisesToSession: vi.fn(),
  mockCheckBudget: vi.fn(),
  mockRecordUsageEvent: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('$lib/server/ai', () => ({
  generateSessionPlan: (input: unknown, options: unknown) => {
    mockGenerateSessionPlanOptions(options);
    return mockGenerateSessionPlan(input);
  },
  TOPIC_CATEGORIES: [
    { key: 'greetings_basics' },
    { key: 'travel_essentials' },
    { key: 'food_dining' },
    { key: 'transport' },
    { key: 'shopping' },
    { key: 'directions' },
    { key: 'hotel_accommodation' },
    { key: 'emergencies_health' },
    { key: 'social_conversation' },
    { key: 'sightseeing_culture' },
    { key: 'bars_nightlife' },
  ],
}));

vi.mock('$lib/server/db', () => ({
  attachExercisesToSession: mockAttachExercisesToSession,
  createSessionRecord: mockCreateSessionRecord,
  deleteStaleGhostSessions: mockDeleteStaleGhostSessions,
  getCompletedAiExerciseResultsForUser: mockGetCompletedAiExerciseResultsForUser,
  getCompletedAiSessionsForUser: mockGetCompletedAiSessionsForUser,
  getExerciseResultsForUser: mockGetExerciseResultsForUser,
  getSessionsForUser: mockGetSessionsForUser,
}));

vi.mock('$lib/server/token-limiter', () => ({
  checkBudget: mockCheckBudget,
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/users', () => ({
  getUser: mockGetUser,
}));

import { POST } from './generate/+server';

const keyPhrases = [
  {
    japanese: 'こんにちは',
    romaji: 'konnichiwa',
    english: 'Hello',
    usage: 'Use as a daytime greeting.',
  },
  {
    japanese: 'はじめまして',
    romaji: 'hajimemashite',
    english: 'Nice to meet you',
    usage: 'Use when meeting someone for the first time.',
  },
  {
    japanese: 'よろしくお願いします',
    romaji: 'yoroshiku onegaishimasu',
    english: 'Please treat me kindly',
    usage: 'Use to close a first introduction politely.',
  },
];

const lesson = {
  topic: 'Basic greetings',
  category: 'greetings_basics',
  explanation: 'Learn a few polite greeting phrases.',
  culturalNote: 'Use a calm, friendly greeting when entering a small shop.',
  keyPhrases,
};

const alternateCategoryLesson = {
  ...lesson,
  topic: 'Ordering food',
  category: 'food_dining',
  explanation: 'Learn a few polite ordering phrases.',
  culturalNote: 'Be polite with staff.',
};

const exercises = [
  {
    id: 'exercise-1',
    type: 'multiple_choice',
    title: 'Ordering food',
    japanese: 'ください',
    romaji: 'kudasai',
    englishContext: 'Please give me...',
    tags: ['food'],
    difficulty: 1,
    question: 'What does ください mean?',
    choices: ['Please', 'Goodbye'],
    correctAnswer: 'Please',
  },
];

const session = {
  id: 'session-1',
  userId: 'user-1',
  mode: 'ai',
  status: 'planned',
  model: 'gpt-5.4',
  tokenInput: 10,
  tokenOutput: 20,
  summary: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  completedAt: null,
};

const generatedPlan = {
  model: 'gpt-5.4',
  lesson,
  exercises,
  tokenUsage: {
    input: 10,
    output: 20,
  },
  metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
};

const hotelTransferTask =
  'In a hotel lobby, apply the selected Learning Objective through a new interaction and transfer challenge.';
const originHotelReviewTopic =
  'Hotel lobby review: Ask where someone is from and state a country or place of origin.';

const canonicalObjectiveCases = [
  {
    category: 'food_dining',
    masteredObjectiveId: 'food_dining.order_food_and_drinks',
    masteredTopic: 'Ordering a meal and drinks',
    paraphrasedTopic: 'Placing a restaurant food and beverage order',
    freshObjectiveId: 'food_dining.ask_about_menu_items',
    freshTopic: 'Asking what a menu item contains',
  },
  {
    category: 'transport',
    masteredObjectiveId: 'transport.buy_a_ticket',
    masteredTopic: 'Buying a train ticket',
    paraphrasedTopic: 'Purchasing the fare for a journey',
    freshObjectiveId: 'transport.find_the_correct_platform_or_stop',
    freshTopic: 'Finding the right departure platform',
  },
  {
    category: 'shopping',
    masteredObjectiveId: 'shopping.ask_for_and_find_an_item',
    masteredTopic: 'Finding an item in a shop',
    paraphrasedTopic: 'Asking where a product is stocked',
    freshObjectiveId: 'shopping.ask_and_understand_a_price',
    freshTopic: 'Checking the price of an item',
  },
  {
    category: 'directions',
    masteredObjectiveId: 'directions.ask_the_way_to_a_destination',
    masteredTopic: 'Asking the way to a landmark',
    paraphrasedTopic: 'Requesting directions to a destination',
    freshObjectiveId: 'directions.understand_route_instructions',
    freshTopic: 'Following spoken turn-by-turn directions',
  },
  {
    category: 'hotel_accommodation',
    masteredObjectiveId: 'hotel_accommodation.check_in_with_a_reservation',
    masteredTopic: 'Checking in with a hotel booking',
    paraphrasedTopic: 'Arriving and registering for a reserved room',
    freshObjectiveId: 'hotel_accommodation.check_out_and_settle_charges',
    freshTopic: 'Checking out and confirming the final bill',
  },
  {
    category: 'emergencies_health',
    masteredObjectiveId: 'emergencies_health.describe_symptoms_and_severity',
    masteredTopic: 'Describing an illness and how serious it feels',
    paraphrasedTopic: 'Explaining symptoms and their severity',
    freshObjectiveId: 'emergencies_health.ask_a_pharmacist_for_medicine',
    freshTopic: 'Asking a pharmacist for suitable medicine',
  },
  {
    category: 'social_conversation',
    masteredObjectiveId: 'social_conversation.expand_a_self_introduction',
    masteredTopic: 'Sharing more about yourself after meeting someone',
    paraphrasedTopic: 'Expanding a brief personal introduction',
    freshObjectiveId: 'social_conversation.discuss_hobbies_and_interests',
    freshTopic: 'Talking about hobbies and interests',
  },
  {
    category: 'sightseeing_culture',
    masteredObjectiveId: 'sightseeing_culture.confirm_admission_and_opening_details',
    masteredTopic: 'Checking attraction entry and opening details',
    paraphrasedTopic: 'Confirming when and how to enter a cultural site',
    freshObjectiveId: 'sightseeing_culture.ask_about_a_landmark_or_exhibit',
    freshTopic: 'Asking what an exhibit represents',
  },
  {
    category: 'bars_nightlife',
    masteredObjectiveId: 'bars_nightlife.choose_a_drink_and_serving_style',
    masteredTopic: 'Choosing a drink and how it is served',
    paraphrasedTopic: 'Selecting a beverage and preferred serving style',
    freshObjectiveId: 'bars_nightlife.request_a_non_alcoholic_option',
    freshTopic: 'Requesting a non-alcoholic drink',
  },
] as const;

function buildGeneratedPlan(
  overrides: {
    lesson?: Partial<typeof lesson>;
    tokenUsage?: { input: number; output: number };
    model?: string;
    metadata?: Record<string, unknown>;
  } = {},
) {
  return {
    model: overrides.model ?? generatedPlan.model,
    lesson: { ...lesson, ...overrides.lesson },
    exercises,
    tokenUsage: overrides.tokenUsage ?? generatedPlan.tokenUsage,
    metadata: overrides.metadata ?? generatedPlan.metadata,
  };
}

function buildSessionSummary(input: {
  category: string;
  topic: string;
  learningObjectiveId?: string;
  accuracy?: number;
  keyPhraseDetails?: Array<{
    japanese?: string;
    romaji?: string;
    english?: string;
    usage?: string;
  }>;
  keyPhrases?: string[];
  weaknesses?: string[];
  handoffNotes?: string[];
  reviewIntents?: Array<{
    type: 'key_phrase' | 'lesson_topic';
    identity: string;
    display: string;
    reason: string;
    reviewRequested: true;
  }>;
}) {
  const keyPhraseDetails = input.keyPhraseDetails ?? [];
  return JSON.stringify({
    summaryText: `Summary for ${input.topic}`,
    category: input.category,
    learningObjectiveId: input.learningObjectiveId,
    topic: input.topic,
    accuracy: input.accuracy ?? 80,
    strengths: [],
    weaknesses: input.weaknesses ?? [],
    nextSteps: [],
    handoffNotes: input.handoffNotes ?? [],
    reviewIntents: input.reviewIntents ?? [],
    exerciseTypes: ['multiple_choice'],
    keyPhrases:
      input.keyPhrases ??
      keyPhraseDetails
        .map((phrase) => phrase.japanese ?? phrase.romaji ?? phrase.english ?? '')
        .filter(Boolean),
    keyPhraseDetails,
  });
}

function buildCompletedAiSession(input: {
  id: string;
  createdAt: string;
  category: string;
  topic: string;
  learningObjectiveId?: string;
  accuracy?: number;
  keyPhraseDetails?: Array<{
    japanese?: string;
    romaji?: string;
    english?: string;
    usage?: string;
  }>;
  weaknesses?: string[];
  handoffNotes?: string[];
  reviewIntents?: Array<{
    type: 'key_phrase' | 'lesson_topic';
    identity: string;
    display: string;
    reason: string;
    reviewRequested: true;
  }>;
  lessonTreatment?: string;
}) {
  return {
    id: input.id,
    userId: 'user-1',
    mode: 'ai',
    status: 'completed',
    model: 'gpt-5.4',
    tokenInput: 10,
    tokenOutput: 20,
    summary: buildSessionSummary(input),
    plannedCoverage: {
      version: 1,
      category: input.category,
      lessonTopic: input.topic,
      lessonTreatment:
        input.lessonTreatment ??
        JSON.stringify({
          topic: input.topic,
          explanation: `Practice ${input.topic} in a neutral indoor setting.`,
          exercises: [],
        }),
      lessonTreatmentComplete: true,
      culturalNote: 'Test note.',
      keyPhraseDetails: [],
    },
    createdAt: input.createdAt,
    completedAt: input.createdAt,
  };
}

function buildMultipleChoiceExercise(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exercise-coverage-1',
    type: 'multiple_choice',
    title: 'Request politely',
    japanese: 'ください',
    romaji: 'kudasai',
    englishContext: 'Please give me...',
    tags: ['food'],
    difficulty: 1,
    question: 'What does ください (kudasai) mean?',
    choices: ['Please', 'Goodbye'],
    correctAnswer: 'Please',
    ...overrides,
  };
}

function buildMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    name: 'Test User',
    level: 'beginner',
    japaneseWritingEnabled: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastActiveAt: null,
    progressJournal: null,
    ...overrides,
  };
}

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/session/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function buildRawRequest(body: string): Request {
  return new Request('http://localhost/api/session/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function buildCookies(selectedUserId: string | null = 'user-1') {
  const cookieValue = selectedUserId ?? undefined;

  return {
    get(name: string) {
      return name === 'selected_user' ? cookieValue : undefined;
    },
  };
}

async function generateSession(body: unknown, selectedUserId: string | null = 'user-1') {
  return POST({ request: buildRequest(body), cookies: buildCookies(selectedUserId) } as never);
}

function expectNoGenerationDbOrTokenWrites() {
  expect(mockGenerateSessionPlan).not.toHaveBeenCalled();
  expect(mockDeleteStaleGhostSessions).not.toHaveBeenCalled();
  expect(mockGetCompletedAiExerciseResultsForUser).not.toHaveBeenCalled();
  expect(mockGetCompletedAiSessionsForUser).not.toHaveBeenCalled();
  expect(mockGetExerciseResultsForUser).not.toHaveBeenCalled();
  expect(mockGetSessionsForUser).not.toHaveBeenCalled();
  expect(mockCreateSessionRecord).not.toHaveBeenCalled();
  expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
  expect(mockCheckBudget).not.toHaveBeenCalled();
  expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  expect(mockGetUser).not.toHaveBeenCalled();
}

describe('POST /api/session/generate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
    mockGenerateSessionPlan.mockReset();
    mockGenerateSessionPlanOptions.mockReset();
    mockDeleteStaleGhostSessions.mockReset();
    mockGetCompletedAiExerciseResultsForUser.mockReset();
    mockGetCompletedAiSessionsForUser.mockReset();
    mockGetExerciseResultsForUser.mockReset();
    mockGetSessionsForUser.mockReset();
    mockCreateSessionRecord.mockReset();
    mockAttachExercisesToSession.mockReset();
    mockCheckBudget.mockReset();
    mockRecordUsageEvent.mockReset();
    mockGetUser.mockReset();

    mockCheckBudget.mockResolvedValue({ allowed: true });
    mockGetUser.mockResolvedValue(buildMockUser());
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValue([]);
    mockGetCompletedAiSessionsForUser.mockResolvedValue([]);
    mockGetSessionsForUser.mockResolvedValue([]);
    mockGetExerciseResultsForUser.mockResolvedValue([]);
    mockGenerateSessionPlan.mockResolvedValue(generatedPlan);
    mockCreateSessionRecord.mockResolvedValue(session);
    mockAttachExercisesToSession.mockResolvedValue(undefined);
    mockRecordUsageEvent.mockResolvedValue(undefined);
  });

  it('generates a session for a matching selected_user cookie using the trimmed userId and clamped exerciseCount', async () => {
    const response = await generateSession({ userId: ' user-1 ', exerciseCount: 99 }, ' user-1 ');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'active',
      session,
      lesson,
      exercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockCheckBudget).toHaveBeenCalledWith('user-1');
    expect(mockGetUser).toHaveBeenCalledWith('user-1');
    expect(mockGetSessionsForUser).toHaveBeenCalledWith('user-1', 10);
    expect(mockGetCompletedAiSessionsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGetCompletedAiExerciseResultsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGetExerciseResultsForUser).toHaveBeenCalledWith('user-1');
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exerciseCount: 12,
        japaneseWritingEnabled: false,
        coverageEvidence: expect.objectContaining({
          categoryRotation: expect.objectContaining({
            selectedCategory: 'greetings_basics',
          }),
        }),
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'ai',
      status: 'planned',
      model: 'gpt-5.4',
      tokenInput: 10,
      tokenOutput: 20,
      plannedCoverage: {
        version: 1,
        category: 'greetings_basics',
        learningObjectiveId: 'greetings_basics.greet_by_time',
        lessonTopic: 'Basic greetings',
        lessonTreatment: JSON.stringify({
          topic: lesson.topic,
          explanation: lesson.explanation,
          exercises,
        }),
        lessonTreatmentComplete: true,
        culturalNote: 'Use a calm, friendly greeting when entering a small shop.',
        keyPhraseDetails: keyPhrases,
      },
    });
    expect(mockAttachExercisesToSession).toHaveBeenCalledWith('session-1', exercises);
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 10,
      tokensOut: 20,
    });
  });

  it('generates a session when no selected_user cookie is present', async () => {
    const response = await generateSession({ userId: ' user-1 ', exerciseCount: 2 }, null);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      state: 'active',
      session,
      lesson,
      exercises,
    });
    expect(mockDeleteStaleGhostSessions).toHaveBeenCalledWith('user-1');
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        exerciseCount: 4,
      }),
    );
  });

  it('passes and persists the app-selected Learning Objective identity', async () => {
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGenerateSessionPlan.mockResolvedValueOnce(
      buildGeneratedPlan({
        metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
      }),
    );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        coverageEvidence: expect.objectContaining({
          learningObjectiveSelection: expect.objectContaining({
            mode: 'canonical',
            reason: 'selected_uncovered_objective',
            objective: expect.objectContaining({
              id: 'greetings_basics.greet_by_time',
            }),
          }),
        }),
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedCoverage: expect.objectContaining({
          category: 'greetings_basics',
          learningObjectiveId: 'greetings_basics.greet_by_time',
          lessonTopic: 'Basic greetings',
        }),
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[api/session/generate] selected curriculum target',
      expect.objectContaining({
        selectedCategory: 'greetings_basics',
        selectedLearningObjectiveId: 'greetings_basics.greet_by_time',
        learningObjectiveSelectionReason: 'selected_uncovered_objective',
        parseableCompletedAiSessions: 0,
        ignoredCompletedAiSessions: 0,
      }),
    );
    expect(logSpy).toHaveBeenCalledWith(
      '[api/session/generate] curriculum plan approved',
      expect.objectContaining({
        attempt: 1,
        validationReasonCodes: [],
        selectedCategory: 'greetings_basics',
        selectedLearningObjectiveId: 'greetings_basics.greet_by_time',
        learningObjectiveSelectionReason: 'selected_uncovered_objective',
        reviewCandidateReasonCodes: [],
        reviewCandidateResolutionState: 'none_selected',
        parseableCompletedAiSessions: 0,
        ignoredCompletedAiSessions: 0,
      }),
    );
  });

  it.each(canonicalObjectiveCases)(
    'rejects a semantic repeat and persists fresh Category Depth for $category',
    async ({
      category,
      masteredObjectiveId,
      masteredTopic,
      paraphrasedTopic,
      freshObjectiveId,
      freshTopic,
    }) => {
      const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
        buildCompletedAiSession({
          id: `${category}-mastery`,
          createdAt: '2026-05-03T08:00:00.000Z',
          category,
          topic: masteredTopic,
          learningObjectiveId: masteredObjectiveId,
          accuracy: 100,
        }),
      ]);
      mockGenerateSessionPlan
        .mockResolvedValueOnce(
          buildGeneratedPlan({
            lesson: { category, topic: paraphrasedTopic },
            metadata: { learningObjectiveId: masteredObjectiveId },
          }),
        )
        .mockResolvedValueOnce(
          buildGeneratedPlan({
            lesson: { category, topic: freshTopic },
            metadata: { learningObjectiveId: freshObjectiveId },
          }),
        );

      const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

      expect(response.status).toBe(200);
      expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
      expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          coverageEvidence: expect.objectContaining({
            learningObjectiveSelection: expect.objectContaining({
              mode: 'canonical',
              reason: 'selected_uncovered_objective',
              objective: expect.objectContaining({ id: freshObjectiveId, category }),
            }),
          }),
        }),
      );
      expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          curriculumValidationFeedback: expect.arrayContaining([
            expect.stringContaining('repeated_learning_objective'),
          ]),
        }),
      );
      expect(mockCreateSessionRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          plannedCoverage: expect.objectContaining({
            category,
            learningObjectiveId: freshObjectiveId,
            lessonTopic: freshTopic,
          }),
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        '[api/session/generate] selected curriculum target',
        expect.objectContaining({
          selectedCategory: category,
          selectedLearningObjectiveId: freshObjectiveId,
          learningObjectiveSelectionReason: 'selected_uncovered_objective',
          parseableCompletedAiSessions: 1,
          ignoredCompletedAiSessions: 0,
        }),
      );
    },
  );

  it('rejects a model-invented identity in a newly migrated category', async () => {
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
      buildCompletedAiSession({
        id: 'health-1',
        createdAt: '2026-05-03T08:00:00.000Z',
        category: 'emergencies_health',
        topic: 'Finding a pharmacy',
      }),
    ]);
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: {
            topic: 'Describing cold symptoms and their severity',
            category: 'emergencies_health',
          },
          metadata: { learningObjectiveId: 'emergencies_health.model_invented_goal' },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: {
            topic: 'Describing cold symptoms and their severity',
            category: 'emergencies_health',
          },
          metadata: {
            learningObjectiveId: 'emergencies_health.describe_symptoms_and_severity',
          },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedCoverage: expect.objectContaining({
          category: 'emergencies_health',
          learningObjectiveId: 'emergencies_health.describe_symptoms_and_severity',
        }),
      }),
    );
  });

  it('passes the persisted Japanese writing preference into session generation', async () => {
    mockGetUser.mockResolvedValueOnce(buildMockUser({ japaneseWritingEnabled: true }));

    const response = await generateSession(
      { userId: 'user-1', exerciseCount: 8, japaneseWritingEnabled: false },
      'user-1',
    );

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        japaneseWritingEnabled: true,
      }),
    );
  });

  it('builds Coverage Evidence from full completed AI history and joined exercise results for generation', async () => {
    mockGetUser.mockResolvedValueOnce(
      buildMockUser({
        progressJournal: 'Learner still hesitates on ください (kudasai) requests.',
      }),
    );
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
      buildCompletedAiSession({
        id: 'session-2',
        createdAt: '2026-05-03T08:00:00.000Z',
        category: 'food_dining',
        topic: 'Restaurant requests',
        accuracy: 45,
        weaknesses: ['Needs more practice with ください (kudasai).'],
        handoffNotes: ['Review ください (kudasai) before moving on.'],
        keyPhraseDetails: [
          {
            japanese: 'ください',
            romaji: 'kudasai',
            english: 'please give me',
            usage: 'Use when requesting an item.',
          },
        ],
      }),
      buildCompletedAiSession({
        id: 'session-1',
        createdAt: '2026-05-02T08:00:00.000Z',
        category: 'food_dining',
        topic: 'Ordering food',
        keyPhraseDetails: [
          {
            japanese: 'すみません',
            romaji: 'sumimasen',
            english: 'excuse me',
            usage: 'Use to get attention politely.',
          },
        ],
      }),
    ]);
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValueOnce([
      {
        sessionId: 'session-2',
        exerciseId: 'exercise-coverage-1',
        isCorrect: false,
        answerText: 'I said kudasai too late',
        createdAt: '2026-05-03T08:10:00.000Z',
        exercise: buildMultipleChoiceExercise(),
      },
    ]);
    mockGenerateSessionPlan.mockResolvedValueOnce(
      buildGeneratedPlan({
        lesson: { topic: 'Ordering a set meal', category: 'food_dining' },
        metadata: { learningObjectiveId: 'food_dining.order_food_and_drinks' },
      }),
    );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        learningJournal: 'Learner still hesitates on ください (kudasai) requests.',
        totalSessionCount: 2,
        coverageEvidence: expect.objectContaining({
          source: {
            totalCompletedAiSessions: 2,
            parseableCompletedAiSessions: 2,
            ignoredCompletedAiSessions: 0,
          },
          categoryRotation: expect.objectContaining({
            currentCategory: 'food_dining',
            currentCategoryStreak: 2,
            selectedCategory: 'food_dining',
            selectionReason: 'continued_current_category_for_review_candidate',
          }),
          learningObjectiveSelection: expect.objectContaining({
            mode: 'canonical',
            reason: 'selected_uncovered_objective',
            objective: expect.objectContaining({
              id: 'food_dining.order_food_and_drinks',
            }),
          }),
          avoidKeyPhrases: expect.arrayContaining([
            expect.objectContaining({ display: 'ください (kudasai)' }),
            expect.objectContaining({ display: 'すみません (sumimasen)' }),
          ]),
          reviewCandidates: expect.arrayContaining([
            expect.objectContaining({
              type: 'key_phrase',
              display: 'ください (kudasai)',
            }),
          ]),
        }),
      }),
    );
  });

  it('accepts an explicit intentional review of the selected eligible candidate', async () => {
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const greetingObjectives = [
      ['greetings_basics.greet_by_time', 'Greeting by time'],
      ['greetings_basics.exchange_names', 'Exchanging names'],
      ['greetings_basics.exchange_origins', 'Exchanging origins'],
      ['greetings_basics.ask_and_answer_wellbeing', 'Asking about wellbeing'],
      ['greetings_basics.use_polite_thanks_and_apologies', 'Polite thanks and apologies'],
      ['greetings_basics.open_and_close_brief_interactions', 'Opening and closing interactions'],
    ];
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce(
      greetingObjectives.flatMap(([learningObjectiveId, topic], index) => [
        buildCompletedAiSession({
          id: `travel-${index + 1}`,
          createdAt: `2026-05-${String(index * 2 + 1).padStart(2, '0')}T08:00:00.000Z`,
          category: 'travel_essentials',
          topic: `Travel literacy ${index + 1}`,
          accuracy: 80,
        }),
        buildCompletedAiSession({
          id: `greeting-${index + 1}`,
          createdAt: `2026-05-${String(index * 2 + 2).padStart(2, '0')}T08:00:00.000Z`,
          category: 'greetings_basics',
          topic,
          learningObjectiveId,
          accuracy: 80,
          reviewIntents:
            learningObjectiveId === 'greetings_basics.exchange_origins'
              ? [
                  {
                    type: 'lesson_topic',
                    identity: 'exchanging origins',
                    display: 'Exchanging origins',
                    reason: 'The learner still hesitates when asking the reciprocal question.',
                    reviewRequested: true,
                  },
                ]
              : [],
          lessonTreatment:
            learningObjectiveId === 'greetings_basics.exchange_origins'
              ? JSON.stringify({
                  topic,
                  explanation: 'Exchange origins with another passenger inside a railway terminal.',
                  exercises: [],
                })
              : undefined,
        }),
      ]),
    );
    mockGenerateSessionPlan.mockResolvedValueOnce(
      buildGeneratedPlan({
        lesson: { topic: originHotelReviewTopic },
        metadata: {
          learningObjectiveId: 'greetings_basics.exchange_origins',
          intentionalReview: {
            candidateType: 'lesson_topic',
            candidateIdentity: 'exchanging origins',
            learningObjectiveId: 'greetings_basics.exchange_origins',
            transferContextId: 'hotel_lobby',
            transferTask: hotelTransferTask,
          },
        },
      }),
    );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        coverageEvidence: expect.objectContaining({
          learningObjectiveSelection: expect.objectContaining({
            reason: 'selected_review_candidate_objective',
            objective: expect.objectContaining({
              id: 'greetings_basics.exchange_origins',
            }),
            reviewCandidate: expect.objectContaining({
              type: 'lesson_topic',
              identity: 'exchanging origins',
              reasonCodes: ['structured_review_intent'],
              originalTreatmentContextIds: ['station_encounter'],
              treatmentEvidenceComplete: true,
            }),
          }),
        }),
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[api/session/generate] selected curriculum target',
      expect.objectContaining({
        reviewCandidateType: 'lesson_topic',
        reviewCandidateResolutionState: 'eligible_unresolved',
      }),
    );
  });

  it('rejects a neutral journal-only review claim and retries without authorizing repetition', async () => {
    mockGetUser.mockResolvedValueOnce(
      buildMockUser({
        progressJournal: '**Categories & topics covered** - Basic greetings completed.',
      }),
    );
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          metadata: {
            learningObjectiveId: 'greetings_basics.greet_by_time',
            intentionalReview: {
              candidateType: 'lesson_topic',
              candidateIdentity: 'basic greetings',
              learningObjectiveId: 'greetings_basics.greet_by_time',
              transferContextId: 'station_encounter',
              transferTask: 'Greet a shopkeeper in the afternoon.',
            },
          },
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
          tokenUsage: { input: 13, output: 21 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        learningJournal: '**Categories & topics covered** - Basic greetings completed.',
        coverageEvidence: expect.objectContaining({ reviewCandidates: [] }),
      }),
    );
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        curriculumValidationFeedback: expect.arrayContaining([
          expect.stringContaining('ineligible_review'),
        ]),
      }),
    );
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionId: null, tokensIn: 11, tokensOut: 22 }),
    );
  });

  it('retries after one repeated non-review Lesson Key Phrase', async () => {
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
      buildCompletedAiSession({
        id: 'greeting-coverage',
        createdAt: '2026-05-01T08:00:00.000Z',
        category: 'greetings_basics',
        topic: 'Greeting by time',
        learningObjectiveId: 'greetings_basics.greet_by_time',
        accuracy: 100,
        keyPhraseDetails: [keyPhrases[0]!],
      }),
    ]);
    const freshKeyPhrases = [
      {
        japanese: 'お名前は何ですか',
        romaji: 'onamae wa nan desu ka',
        english: 'What is your name?',
        usage: 'Ask for a name politely.',
      },
      {
        japanese: 'トゥーッカです',
        romaji: 'Tuukka desu',
        english: 'I am Tuukka.',
        usage: 'State your name.',
      },
      {
        japanese: 'こちらこそ',
        romaji: 'kochira koso',
        english: 'Likewise.',
        usage: 'Return a polite first-meeting sentiment.',
      },
    ];
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'Exchanging names' },
          metadata: { learningObjectiveId: 'greetings_basics.exchange_names' },
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'Exchanging names', keyPhrases: freshKeyPhrases },
          metadata: { learningObjectiveId: 'greetings_basics.exchange_names' },
          tokenUsage: { input: 13, output: 21 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        curriculumValidationFeedback: expect.arrayContaining([
          expect.stringContaining('repeated_key_phrases'),
          expect.stringContaining('Do not repeat any covered Lesson Key Phrase'),
        ]),
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedCoverage: expect.objectContaining({ keyPhraseDetails: freshKeyPhrases }),
      }),
    );
  });

  it('rejects a paraphrased mastered objective after seven intervening sessions', async () => {
    const masteredPhrase = {
      japanese: 'ください',
      romaji: 'kudasai',
      english: 'please give me',
      usage: 'Use when requesting an item.',
    };
    const masterySessions = [
      buildCompletedAiSession({
        id: 'old-weakness',
        createdAt: '2026-05-01T08:00:00.000Z',
        category: 'greetings_basics',
        topic: 'Saying where you are from',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        accuracy: 0,
        weaknesses: ['The origin exchange was difficult.'],
        handoffNotes: ['Review the origin exchange.'],
        reviewIntents: [
          {
            type: 'lesson_topic',
            identity: 'saying where you are from',
            display: 'Saying where you are from',
            reason: 'The learner had not yet mastered the origin exchange.',
            reviewRequested: true,
          },
        ],
        keyPhraseDetails: [masteredPhrase],
      }),
      buildCompletedAiSession({
        id: 'mastery',
        createdAt: '2026-05-02T08:00:00.000Z',
        category: 'greetings_basics',
        topic: 'Saying where you are from',
        learningObjectiveId: 'greetings_basics.exchange_origins',
        accuracy: 100,
        weaknesses: ['Explore more nuance in origin exchanges.'],
        handoffNotes: ['Origin exchanges are now a strength.'],
        keyPhraseDetails: [masteredPhrase],
      }),
      ...[
        ['travel_essentials', 'Reading prices'],
        ['food_dining', 'Paying at a restaurant'],
        ['transport', 'Finding a platform'],
        ['shopping', 'Choosing a size'],
        ['directions', 'Finding an exit'],
        ['hotel_accommodation', 'Checking in'],
        ['greetings_basics', 'Morning greetings'],
      ].map(([category, topic], index) =>
        buildCompletedAiSession({
          id: `intervening-${index + 1}`,
          createdAt: `2026-05-${String(index + 3).padStart(2, '0')}T08:00:00.000Z`,
          category,
          topic,
          learningObjectiveId:
            category === 'greetings_basics'
              ? 'greetings_basics.greet_by_time'
              : category === 'travel_essentials'
                ? 'travel_essentials.understand_prices_and_payments'
                : undefined,
          accuracy: 100,
        }),
      ),
    ];
    mockGetUser.mockResolvedValueOnce(
      buildMockUser({
        progressJournal: [
          '**Categories & topics covered** - greetings_basics: Saying where you are from',
          '**Vocabulary bank** - ください',
          '**Persistent weak spots** - none',
          '**Progress snapshot** - origin exchanges mastered',
          '**Learning trajectory** - building beyond origin exchanges',
        ].join('\n'),
      }),
    );
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce(masterySessions);
    mockGetCompletedAiExerciseResultsForUser.mockResolvedValueOnce([
      {
        sessionId: 'old-weakness',
        exerciseId: 'old-weakness-result',
        isCorrect: false,
        answerText: 'incorrect',
        createdAt: '2026-05-01T08:10:00.000Z',
        exercise: buildMultipleChoiceExercise({ id: 'old-weakness-result' }),
      },
      {
        sessionId: 'mastery',
        exerciseId: 'mastery-result',
        isCorrect: true,
        answerText: 'Please',
        createdAt: '2026-05-02T08:10:00.000Z',
        exercise: buildMultipleChoiceExercise({ id: 'mastery-result' }),
      },
    ]);
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'Introducing your country of origin' },
          metadata: {
            learningObjectiveId: 'greetings_basics.exchange_origins',
            intentionalReview: {
              candidateType: 'lesson_topic',
              candidateIdentity: 'saying where you are from',
              learningObjectiveId: 'greetings_basics.exchange_origins',
              transferContextId: 'station_encounter',
              transferTask: 'Exchange origins with another traveler on a train.',
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'Introducing yourself by name' },
          metadata: { learningObjectiveId: 'greetings_basics.exchange_names' },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        learningJournal: expect.stringContaining('origin exchanges mastered'),
        coverageEvidence: expect.objectContaining({
          reviewCandidates: [],
          learningObjectiveSelection: expect.objectContaining({
            objective: expect.objectContaining({ id: 'greetings_basics.exchange_names' }),
          }),
        }),
      }),
    );
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        curriculumValidationFeedback: expect.arrayContaining([
          expect.stringContaining('repeated_learning_objective'),
          expect.stringContaining('ineligible_review'),
        ]),
      }),
    );
  });

  it('returns the existing budget-exhausted response shape', async () => {
    const budgetInfo = { allowed: false, remainingTokens: 0, limit: 100 };
    mockCheckBudget.mockResolvedValueOnce(budgetInfo);

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      state: 'budget_exhausted',
      session: null,
      lesson: null,
      exercises: [],
      budgetInfo,
    });
    expect(mockGenerateSessionPlan).not.toHaveBeenCalled();
    expect(mockCreateSessionRecord).not.toHaveBeenCalled();
    expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).not.toHaveBeenCalled();
  });

  it('returns 403 without generation/DB/token writes when selected_user does not match body userId', async () => {
    const response = await generateSession({ userId: 'user-2', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Selected user does not match request user.',
    });
    expectNoGenerationDbOrTokenWrites();
  });

  it('returns 400 for invalid JSON without generation/DB/token writes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST({
      request: buildRawRequest('{not json'),
      cookies: buildCookies('user-1'),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Invalid JSON body.' });
    expectNoGenerationDbOrTokenWrites();
  });

  it.each([
    ['missing', {}],
    ['blank', { userId: '   ', exerciseCount: 8 }],
  ])('returns 400 for a %s userId without generation/DB/token writes', async (_caseName, body) => {
    const response = await generateSession(body, 'user-1');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'Missing userId.' });
    expectNoGenerationDbOrTokenWrites();
  });

  it('returns a timeout error instead of hanging forever when generation stalls', async () => {
    vi.stubEnv('SESSION_GENERATION_TIMEOUT_MS', '10');
    mockGenerateSessionPlan.mockImplementation(() => new Promise(() => {}));

    const result = await Promise.race([
      generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1'),
      new Promise((resolve) => setTimeout(() => resolve('timed-out-in-test'), 60)),
    ]);

    expect(result).not.toBe('timed-out-in-test');

    const response = result as Response;
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/timed out/i),
    });
    const options = mockGenerateSessionPlanOptions.mock.calls[0]?.[0] as {
      signal?: AbortSignal;
    };
    expect(options.signal?.aborted).toBe(true);
  });

  it('gives a curriculum-validation retry its own generation timeout', async () => {
    vi.stubEnv('SESSION_GENERATION_TIMEOUT_MS', '50');
    mockGenerateSessionPlan
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  buildGeneratedPlan({
                    lesson: alternateCategoryLesson,
                    tokenUsage: { input: 11, output: 22 },
                  }),
                ),
              35,
            ),
          ),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve(
                  buildGeneratedPlan({
                    lesson: { topic: 'First greetings', category: 'greetings_basics' },
                    tokenUsage: { input: 13, output: 21 },
                  }),
                ),
              35,
            ),
          ),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).toHaveBeenCalledTimes(1);
    expect(mockGenerateSessionPlanOptions).toHaveBeenNthCalledWith(1, {
      signal: expect.any(AbortSignal),
    });
    expect(mockGenerateSessionPlanOptions).toHaveBeenNthCalledWith(2, {
      signal: expect.any(AbortSignal),
    });
    const firstOptions = mockGenerateSessionPlanOptions.mock.calls[0]?.[0] as {
      signal?: AbortSignal;
    };
    const secondOptions = mockGenerateSessionPlanOptions.mock.calls[1]?.[0] as {
      signal?: AbortSignal;
    };
    expect(firstOptions.signal).not.toBe(secondOptions.signal);
  });

  it('records rejected generation usage with a null session id and retries after curriculum validation rejects the first plan', async () => {
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: { topic: 'First greetings', category: 'greetings_basics' },
          tokenUsage: { input: 13, output: 21 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).toHaveBeenCalledWith({
      userId: 'user-1',
      mode: 'ai',
      status: 'planned',
      model: 'gpt-5.4',
      tokenInput: 13,
      tokenOutput: 21,
      plannedCoverage: {
        version: 1,
        category: 'greetings_basics',
        learningObjectiveId: 'greetings_basics.greet_by_time',
        lessonTopic: 'First greetings',
        lessonTreatment: JSON.stringify({
          topic: 'First greetings',
          explanation: lesson.explanation,
          exercises,
        }),
        lessonTreatmentComplete: true,
        culturalNote: 'Use a calm, friendly greeting when entering a small shop.',
        keyPhraseDetails: keyPhrases,
      },
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 11,
      tokensOut: 22,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 13,
      tokensOut: 21,
    });
  });

  it('identifies rejected Lesson Key Phrases so the retry can replace them', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCompletedAiSessionsForUser.mockResolvedValueOnce([
      buildCompletedAiSession({
        id: 'completed-greeting',
        createdAt: '2026-05-03T08:00:00.000Z',
        category: 'greetings_basics',
        topic: 'Earlier greeting context',
        keyPhraseDetails: [keyPhrases[0]],
      }),
    ]);
    mockGenerateSessionPlan.mockImplementation(
      (input: { curriculumValidationFeedback?: string[] }) => {
        const retryIdentifiesRejectedPhrase = input.curriculumValidationFeedback?.some((item) =>
          item.includes('こんにちは'),
        );
        return Promise.resolve(
          buildGeneratedPlan({
            lesson: {
              keyPhrases: retryIdentifiesRejectedPhrase
                ? [
                    keyPhrases[1],
                    keyPhrases[2],
                    {
                      japanese: 'こんばんは',
                      romaji: 'konbanwa',
                      english: 'Good evening',
                      usage: 'Use as an evening greeting.',
                    },
                  ]
                : keyPhrases,
            },
          }),
        );
      },
    );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        curriculumValidationFeedback: expect.arrayContaining([
          expect.stringContaining('こんにちは'),
        ]),
      }),
    );
    expect(mockCreateSessionRecord).toHaveBeenCalledTimes(1);
  });

  it('retries when the model invents a Learning Objective identity', async () => {
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          metadata: { learningObjectiveId: 'greetings_basics.model_invented_goal' },
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
          tokenUsage: { input: 13, output: 21 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        curriculumValidationFeedback: expect.arrayContaining([
          expect.stringContaining('invalid_learning_objective_identity'),
          expect.stringContaining('greetings_basics.greet_by_time'),
        ]),
      }),
    );
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sessionId: null, tokensIn: 11, tokensOut: 22 }),
    );
    const validationLog = logSpy.mock.calls.find(
      ([message]) => message === '[api/session/generate] curriculum validation failed',
    );
    expect(validationLog?.[1]).toEqual(
      expect.objectContaining({
        attempt: 1,
        validationReasonCodes: ['invalid_learning_objective_identity'],
        parseableCompletedAiSessions: 0,
        ignoredCompletedAiSessions: 0,
        selectedCategory: 'greetings_basics',
        selectedLearningObjectiveId: 'greetings_basics.greet_by_time',
        learningObjectiveSelectionReason: 'selected_uncovered_objective',
        reviewCandidateReasonCodes: [],
        reviewCandidateResolutionState: 'none_selected',
        generatedLearningObjectiveStatus: 'unrecognized',
      }),
    );
    expect(JSON.stringify(validationLog?.[1])).not.toContain('model_invented_goal');
  });

  it('fails closed without creating a session when both generation attempts violate curriculum rails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGenerateSessionPlan
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 11, output: 22 },
        }),
      )
      .mockResolvedValueOnce(
        buildGeneratedPlan({
          lesson: alternateCategoryLesson,
          tokenUsage: { input: 12, output: 23 },
        }),
      );

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to generate AI teaching session.',
    });
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
    expect(mockCreateSessionRecord).not.toHaveBeenCalled();
    expect(mockAttachExercisesToSession).not.toHaveBeenCalled();
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 11,
      tokensOut: 22,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 12,
      tokensOut: 23,
    });
  });

  it('records returned usage when a model response cannot be normalized before retry', async () => {
    const rejectedResponseError = Object.assign(new Error('invalid model response'), {
      generationUsage: { model: 'gpt-5.4', input: 17, output: 9 },
    });
    mockGenerateSessionPlan
      .mockRejectedValueOnce(rejectedResponseError)
      .mockResolvedValueOnce(generatedPlan);

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 });

    expect(response.status).toBe(200);
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(1, {
      userId: 'user-1',
      sessionId: null,
      model: 'gpt-5.4',
      tokensIn: 17,
      tokensOut: 9,
    });
    expect(mockRecordUsageEvent).toHaveBeenNthCalledWith(2, {
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 10,
      tokensOut: 20,
    });
  });

  it('retries once before failing the whole request', async () => {
    mockGenerateSessionPlan
      .mockRejectedValueOnce(new Error('temporary upstream failure'))
      .mockResolvedValueOnce({
        model: 'gpt-5.4',
        lesson,
        exercises,
        tokenUsage: {
          input: 10,
          output: 20,
        },
        metadata: { learningObjectiveId: 'greetings_basics.greet_by_time' },
      });

    const response = await generateSession({ userId: 'user-1', exerciseCount: 8 }, 'user-1');

    expect(response.status).toBe(200);
    expect(mockGenerateSessionPlan).toHaveBeenCalledTimes(2);
  });
});

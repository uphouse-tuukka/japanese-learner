import { isTopicCategoryKey, type TopicCategoryKey } from '$lib/topic-categories';

export type LearningObjective = {
  id: string;
  category: TopicCategoryKey;
  description: string;
  generationGuidance: string;
};

const CATALOG = [
  {
    id: 'greetings_basics.greet_by_time',
    category: 'greetings_basics',
    description: 'Choose and use a basic greeting that fits the time of day.',
    generationGuidance:
      'Teach a short arrival exchange using morning, daytime, or evening greetings. Keep the goal on choosing an appropriate greeting, not on a full self-introduction.',
  },
  {
    id: 'greetings_basics.exchange_names',
    category: 'greetings_basics',
    description: 'Exchange names during a first meeting.',
    generationGuidance:
      "Teach a two-way first-meeting exchange in which the learner says their name and asks or understands the other person's name. Do not expand the goal into country of origin.",
  },
  {
    id: 'greetings_basics.exchange_origins',
    category: 'greetings_basics',
    description: 'Ask where someone is from and state a country or place of origin.',
    generationGuidance:
      'Teach a two-way origin exchange, including understanding a where-are-you-from question and giving a concise answer. The country or city can vary, but the communicative goal remains the same.',
  },
  {
    id: 'greetings_basics.ask_and_answer_wellbeing',
    category: 'greetings_basics',
    description: 'Ask how someone is and give a brief natural response.',
    generationGuidance:
      'Teach a short wellbeing exchange suitable for a casual travel encounter. Keep it distinct from medical symptoms and from a full personal introduction.',
  },
  {
    id: 'greetings_basics.use_polite_thanks_and_apologies',
    category: 'greetings_basics',
    description: 'Respond politely with thanks, apology, or acknowledgement.',
    generationGuidance:
      'Teach the learner to choose a basic thanks, apology, or acknowledgement in a clear everyday interaction. Focus on the response function rather than ordering, navigation, or another scenario task.',
  },
  {
    id: 'greetings_basics.open_and_close_brief_interactions',
    category: 'greetings_basics',
    description: 'Open and close a brief polite interaction.',
    generationGuidance:
      'Teach a compact interaction boundary such as getting attention, opening politely, and taking leave. Do not reteach a time-of-day greeting or a full self-introduction as the main goal.',
  },
  {
    id: 'travel_essentials.recognize_numbers',
    category: 'travel_essentials',
    description: 'Recognize and say common travel numbers.',
    generationGuidance:
      'Build number recognition and production for realistic travel values. Keep the lesson on number literacy rather than attaching it primarily to shopping, transport, or another scenario category.',
  },
  {
    id: 'travel_essentials.express_quantities_with_counters',
    category: 'travel_essentials',
    description: 'Understand and express basic quantities with common counters.',
    generationGuidance:
      'Teach a small, coherent set of quantities and counters useful across travel settings. Prioritize comprehension before production and avoid turning the lesson into a specific restaurant or shop task.',
  },
  {
    id: 'travel_essentials.understand_prices_and_payments',
    category: 'travel_essentials',
    description: 'Understand a stated price and basic payment amount.',
    generationGuidance:
      'Teach portable money literacy such as hearing a price, confirming an amount, or recognizing yen values. The goal is understanding amounts, not completing a purchase scenario.',
  },
  {
    id: 'travel_essentials.ask_and_tell_time',
    category: 'travel_essentials',
    description: 'Ask for and understand clock time.',
    generationGuidance:
      'Teach asking the time and understanding a concise clock-time answer. Keep dates and detailed transport schedules outside the main objective.',
  },
  {
    id: 'travel_essentials.understand_dates',
    category: 'travel_essentials',
    description: 'Recognize and communicate simple calendar dates.',
    generationGuidance:
      'Teach month, day, or a simple date exchange needed for bookings and forms. Keep the focus on date literacy rather than hotel check-in or ticket purchase.',
  },
  {
    id: 'travel_essentials.give_contact_details',
    category: 'travel_essentials',
    description: 'Give and confirm basic contact details.',
    generationGuidance:
      'Teach a bounded exchange involving a phone number, email address, or other contact detail. Include confirmation language without expanding into form completion.',
  },
  {
    id: 'travel_essentials.request_clarification',
    category: 'travel_essentials',
    description: 'Ask someone to repeat, slow down, or clarify.',
    generationGuidance:
      'Teach portable repair phrases for missed speech, excessive speed, or an unknown expression. The learner should practice recovering an interaction rather than solving a scenario-specific task.',
  },
  {
    id: 'travel_essentials.understand_common_signs',
    category: 'travel_essentials',
    description: 'Recognize common public signs and instructions.',
    generationGuidance:
      'Teach recognition of a small set of high-value public signs or short instructions. Keep the emphasis on reading comprehension and immediate meaning.',
  },
  {
    id: 'travel_essentials.complete_simple_forms',
    category: 'travel_essentials',
    description: 'Understand the fields on a simple travel form.',
    generationGuidance:
      'Teach recognition of a few common form labels and the information they request. Do not make the lesson depend on Japanese handwriting or a specific hotel process.',
  },
  {
    id: 'travel_essentials.exchange_wifi_details',
    category: 'travel_essentials',
    description: 'Ask for and understand basic Wi-Fi access details.',
    generationGuidance:
      'Teach a short exchange for asking whether Wi-Fi is available and understanding the network or password response. Keep it portable across venues.',
  },
] as const satisfies readonly LearningObjective[];

function normalizedGoal(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function validateLearningObjectiveCatalog(
  catalog: readonly LearningObjective[],
): readonly LearningObjective[] {
  const identities = new Set<string>();
  const goalsByCategory = new Set<string>();

  for (const objective of catalog) {
    if (!objective.id.trim()) {
      throw new Error('Learning Objective identity is required.');
    }
    if (identities.has(objective.id)) {
      throw new Error(`Duplicate Learning Objective identity: ${objective.id}`);
    }
    identities.add(objective.id);

    if (!isTopicCategoryKey(objective.category)) {
      throw new Error(`Learning Objective ${objective.id} has an unknown Topic Category.`);
    }
    if (!objective.id.startsWith(`${objective.category}.`)) {
      throw new Error(
        `Learning Objective ${objective.id} must start with its Topic Category ${objective.category}.`,
      );
    }
    if (!objective.description.trim()) {
      throw new Error(`Learning Objective ${objective.id} requires a learner-facing description.`);
    }
    if (!objective.generationGuidance.trim()) {
      throw new Error(`Learning Objective ${objective.id} requires generation guidance.`);
    }

    const goalKey = `${objective.category}:${normalizedGoal(objective.description)}`;
    if (goalsByCategory.has(goalKey)) {
      throw new Error(
        `Learning Objective ${objective.id} duplicates a communicative goal in ${objective.category}.`,
      );
    }
    goalsByCategory.add(goalKey);
  }

  return catalog;
}

export const LEARNING_OBJECTIVES = validateLearningObjectiveCatalog(CATALOG);

const OBJECTIVES_BY_ID = new Map(
  LEARNING_OBJECTIVES.map((objective) => [objective.id, objective] as const),
);

export function getLearningObjective(id: string): LearningObjective | null {
  return OBJECTIVES_BY_ID.get(id) ?? null;
}

export function getLearningObjectivesForCategory(category: TopicCategoryKey): LearningObjective[] {
  return LEARNING_OBJECTIVES.filter((objective) => objective.category === category);
}

export function hasCanonicalLearningObjectives(category: TopicCategoryKey): boolean {
  return LEARNING_OBJECTIVES.some((objective) => objective.category === category);
}

export const TOPIC_CATEGORIES = [
  {
    key: 'greetings_basics',
    label: 'Greetings & Basics',
    examples: 'Self-introductions, thank you, excuse me, counting, basic polite phrases',
  },
  {
    key: 'food_dining',
    label: 'Food & Dining',
    examples: 'Restaurants, ordering food, menu items, dietary needs, paying the bill',
  },
  {
    key: 'transport',
    label: 'Transport',
    examples: 'Trains, buses, taxis, buying tickets, asking for platforms, IC cards',
  },
  {
    key: 'shopping',
    label: 'Shopping',
    examples: 'Convenience stores, souvenirs, prices, sizes, trying on clothes',
  },
  {
    key: 'directions',
    label: 'Directions & Navigation',
    examples: 'Asking the way, landmarks, reading signs, using maps',
  },
  {
    key: 'hotel_accommodation',
    label: 'Hotel & Accommodation',
    examples: 'Check-in/out, room requests, problems, amenities',
  },
  {
    key: 'emergencies_health',
    label: 'Emergencies & Health',
    examples: 'Pharmacy, doctor visits, lost items, police, feeling unwell',
  },
  {
    key: 'social_conversation',
    label: 'Social & Conversation',
    examples: 'Small talk, weather, compliments, hobbies, meeting people',
  },
  {
    key: 'sightseeing_culture',
    label: 'Sightseeing & Culture',
    examples: 'Temples, museums, etiquette, customs, photo requests',
  },
  {
    key: 'bars_nightlife',
    label: 'Bars & Nightlife',
    examples: 'Izakaya ordering, drinks, karaoke, bar etiquette, nomikai culture',
  },
] as const;

export type TopicCategoryKey = (typeof TOPIC_CATEGORIES)[number]['key'];

export const TOPIC_CATEGORY_KEYS = TOPIC_CATEGORIES.map(
  (category) => category.key,
) as readonly TopicCategoryKey[];

const TOPIC_CATEGORY_KEY_SET = new Set<string>(TOPIC_CATEGORY_KEYS);

export function isTopicCategoryKey(value: unknown): value is TopicCategoryKey {
  return typeof value === 'string' && TOPIC_CATEGORY_KEY_SET.has(value);
}

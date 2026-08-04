import { describe, expect, it } from 'vitest';
import {
  LEARNING_OBJECTIVES,
  getLearningObjective,
  getLearningObjectivesForCategory,
  hasCanonicalLearningObjectives,
  validateLearningObjectiveCatalog,
} from '$lib/learning-objectives';

describe('canonical Learning Objective catalog', () => {
  it('defines ordered, app-owned objectives for the first two Topic Categories', () => {
    const greetings = getLearningObjectivesForCategory('greetings_basics');
    const travelEssentials = getLearningObjectivesForCategory('travel_essentials');

    expect(greetings.map((objective) => objective.id)).toEqual([
      'greetings_basics.greet_by_time',
      'greetings_basics.exchange_names',
      'greetings_basics.exchange_origins',
      'greetings_basics.ask_and_answer_wellbeing',
      'greetings_basics.use_polite_thanks_and_apologies',
      'greetings_basics.open_and_close_brief_interactions',
    ]);
    expect(travelEssentials.map((objective) => objective.id)).toEqual([
      'travel_essentials.recognize_numbers',
      'travel_essentials.express_quantities_with_counters',
      'travel_essentials.understand_prices_and_payments',
      'travel_essentials.ask_and_tell_time',
      'travel_essentials.understand_dates',
      'travel_essentials.give_contact_details',
      'travel_essentials.request_clarification',
      'travel_essentials.understand_common_signs',
      'travel_essentials.complete_simple_forms',
      'travel_essentials.exchange_wifi_details',
    ]);
    expect(LEARNING_OBJECTIVES.every((objective) => objective.description.trim())).toBe(true);
    expect(LEARNING_OBJECTIVES.every((objective) => objective.generationGuidance.trim())).toBe(
      true,
    );
  });

  it('resolves the country-of-origin objective independently of a generated Lesson Topic title', () => {
    expect(getLearningObjective('greetings_basics.exchange_origins')).toEqual(
      expect.objectContaining({
        category: 'greetings_basics',
        description: expect.stringMatching(/where.*from|country.*origin/i),
      }),
    );
  });

  it('keeps unmigrated categories on the explicit compatibility path', () => {
    expect(hasCanonicalLearningObjectives('greetings_basics')).toBe(true);
    expect(hasCanonicalLearningObjectives('travel_essentials')).toBe(true);
    expect(hasCanonicalLearningObjectives('food_dining')).toBe(false);
    expect(getLearningObjectivesForCategory('food_dining')).toEqual([]);
  });

  it('rejects duplicate identities, category mismatches, and incomplete guidance', () => {
    expect(() =>
      validateLearningObjectiveCatalog([
        {
          id: 'greetings_basics.exchange_names',
          category: 'greetings_basics',
          description: 'Exchange names in a first meeting.',
          generationGuidance: 'Teach a short two-way name exchange.',
        },
        {
          id: 'greetings_basics.exchange_names',
          category: 'travel_essentials',
          description: 'Duplicate identity.',
          generationGuidance: 'This must be rejected.',
        },
      ]),
    ).toThrow(/duplicate Learning Objective identity/i);

    expect(() =>
      validateLearningObjectiveCatalog([
        {
          id: 'greetings_basics.exchange_names',
          category: 'travel_essentials',
          description: 'Exchange names in a first meeting.',
          generationGuidance: 'Teach a short two-way name exchange.',
        },
      ]),
    ).toThrow(/must start with its Topic Category/i);

    expect(() =>
      validateLearningObjectiveCatalog([
        {
          id: 'greetings_basics.exchange_names',
          category: 'greetings_basics',
          description: 'Exchange names in a first meeting.',
          generationGuidance: '   ',
        },
      ]),
    ).toThrow(/generation guidance/i);
  });
});

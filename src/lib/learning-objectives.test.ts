import { describe, expect, it } from 'vitest';
import {
  LEARNING_OBJECTIVES,
  getLearningObjective,
  getLearningObjectivesForCategory,
  hasCanonicalLearningObjectives,
  validateLearningObjectiveCatalog,
} from '$lib/learning-objectives';

describe('canonical Learning Objective catalog', () => {
  it('defines ordered, app-owned objectives for the migrated Topic Categories', () => {
    const greetings = getLearningObjectivesForCategory('greetings_basics');
    const travelEssentials = getLearningObjectivesForCategory('travel_essentials');
    const foodDining = getLearningObjectivesForCategory('food_dining');
    const transport = getLearningObjectivesForCategory('transport');
    const shopping = getLearningObjectivesForCategory('shopping');
    const directions = getLearningObjectivesForCategory('directions');
    const hotelAccommodation = getLearningObjectivesForCategory('hotel_accommodation');

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
    expect(foodDining.map((objective) => objective.id)).toEqual([
      'food_dining.order_food_and_drinks',
      'food_dining.ask_about_menu_items',
      'food_dining.communicate_dietary_needs',
      'food_dining.customize_an_order',
      'food_dining.request_and_pay_the_bill',
      'food_dining.arrange_restaurant_seating',
    ]);
    expect(transport.map((objective) => objective.id)).toEqual([
      'transport.buy_a_ticket',
      'transport.find_the_correct_platform_or_stop',
      'transport.ask_about_departure_and_arrival_times',
      'transport.navigate_a_transfer',
      'transport.use_and_recharge_an_ic_card',
      'transport.take_a_taxi',
      'transport.handle_a_delay_or_cancellation',
    ]);
    expect(shopping.map((objective) => objective.id)).toEqual([
      'shopping.ask_for_and_find_an_item',
      'shopping.ask_and_understand_a_price',
      'shopping.compare_sizes_colors_and_variants',
      'shopping.try_on_clothing',
      'shopping.request_a_quantity_and_purchase',
      'shopping.complete_a_tax_free_purchase',
      'shopping.exchange_or_return_an_item',
    ]);
    expect(directions.map((objective) => objective.id)).toEqual([
      'directions.ask_the_way_to_a_destination',
      'directions.understand_route_instructions',
      'directions.confirm_a_location_on_a_map',
      'directions.find_an_entrance_exit_or_floor',
      'directions.ask_about_distance_and_travel_time',
      'directions.recover_when_lost',
    ]);
    expect(hotelAccommodation.map((objective) => objective.id)).toEqual([
      'hotel_accommodation.check_in_with_a_reservation',
      'hotel_accommodation.check_out_and_settle_charges',
      'hotel_accommodation.ask_about_amenities_and_hours',
      'hotel_accommodation.request_a_room_item_or_service',
      'hotel_accommodation.report_a_room_problem',
      'hotel_accommodation.store_luggage',
      'hotel_accommodation.change_a_reservation_or_stay',
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

  it('keeps only the remaining categories on the explicit compatibility path', () => {
    expect(hasCanonicalLearningObjectives('greetings_basics')).toBe(true);
    expect(hasCanonicalLearningObjectives('travel_essentials')).toBe(true);
    expect(hasCanonicalLearningObjectives('food_dining')).toBe(true);
    expect(hasCanonicalLearningObjectives('transport')).toBe(true);
    expect(hasCanonicalLearningObjectives('shopping')).toBe(true);
    expect(hasCanonicalLearningObjectives('directions')).toBe(true);
    expect(hasCanonicalLearningObjectives('hotel_accommodation')).toBe(true);
    expect(hasCanonicalLearningObjectives('emergencies_health')).toBe(false);
    expect(hasCanonicalLearningObjectives('social_conversation')).toBe(false);
    expect(hasCanonicalLearningObjectives('sightseeing_culture')).toBe(false);
    expect(hasCanonicalLearningObjectives('bars_nightlife')).toBe(false);
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

    expect(() =>
      validateLearningObjectiveCatalog([
        {
          id: 'food_dining.order_food_and_drinks',
          category: 'food_dining',
          description: 'Order a meal and drinks in a restaurant.',
          generationGuidance: 'Teach a concise restaurant order.',
        },
        {
          id: 'food_dining.place_a_restaurant_order',
          category: 'food_dining',
          description: 'Order a meal and drinks in a restaurant!',
          generationGuidance: 'Teach the same goal under a different identity.',
        },
      ]),
    ).toThrow(/duplicates a communicative goal/i);
  });
});

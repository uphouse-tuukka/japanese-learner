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
  {
    id: 'food_dining.order_food_and_drinks',
    category: 'food_dining',
    description: 'Order food and drinks in a restaurant or cafe.',
    generationGuidance:
      'Teach a concise exchange for naming one or more chosen food or drink items and placing the order politely. Do not make menu explanation, dietary needs, customization, seating, or payment the main task.',
  },
  {
    id: 'food_dining.ask_about_menu_items',
    category: 'food_dining',
    description: 'Ask what a menu item is and understand a basic explanation.',
    generationGuidance:
      'Teach the learner to ask what an unfamiliar dish, ingredient, or menu label means and understand a short answer. Keep the goal on identifying menu items rather than ordering or expressing a dietary restriction.',
  },
  {
    id: 'food_dining.communicate_dietary_needs',
    category: 'food_dining',
    description: 'Communicate a dietary restriction or food allergy.',
    generationGuidance:
      'Teach a safety-focused exchange for stating one specific allergy, intolerance, or dietary restriction and confirming whether a dish is suitable. Do not reduce this to a preference-based order customization.',
  },
  {
    id: 'food_dining.customize_an_order',
    category: 'food_dining',
    description: 'Request a simple change or addition to a food order.',
    generationGuidance:
      'Teach one bounded customization such as without an ingredient, an extra item, or a preparation choice. Keep allergies and broad dietary restrictions outside the main goal.',
  },
  {
    id: 'food_dining.request_and_pay_the_bill',
    category: 'food_dining',
    description: 'Request the bill and complete restaurant payment.',
    generationGuidance:
      'Teach the closing payment exchange, including asking for the bill and understanding where or how to pay. Focus on restaurant settlement rather than portable price literacy or placing an order.',
  },
  {
    id: 'food_dining.arrange_restaurant_seating',
    category: 'food_dining',
    description: 'Ask for a table and respond to basic seating questions.',
    generationGuidance:
      'Teach an arrival exchange about party size, seating availability, a reservation, or a short wait. Keep the communicative goal on obtaining a table, not hotel reservations or ordering food.',
  },
  {
    id: 'transport.buy_a_ticket',
    category: 'transport',
    description: 'Buy the appropriate ticket for a journey.',
    generationGuidance:
      'Teach a ticket-counter or machine-support exchange for stating a destination and requesting a simple one-way or return ticket. Do not turn the lesson into general money literacy, platform finding, or schedule checking.',
  },
  {
    id: 'transport.find_the_correct_platform_or_stop',
    category: 'transport',
    description: 'Find the correct platform, boarding point, or stop.',
    generationGuidance:
      'Teach how to ask where a named service departs and understand the platform, bus stop, gate, or boarding-point answer. Keep transfers and route directions outside the main objective.',
  },
  {
    id: 'transport.ask_about_departure_and_arrival_times',
    category: 'transport',
    description: 'Ask when a service departs or arrives.',
    generationGuidance:
      'Teach a schedule exchange for a specific train, bus, ferry, or flight, including understanding a concise departure or arrival time. Keep general clock-time teaching and disruptions outside the main goal.',
  },
  {
    id: 'transport.navigate_a_transfer',
    category: 'transport',
    description: 'Understand and complete a transport transfer.',
    generationGuidance:
      'Teach how to ask whether a transfer is required and understand where or onto which service to change. Focus on connecting services rather than locating the initial platform or buying a ticket.',
  },
  {
    id: 'transport.use_and_recharge_an_ic_card',
    category: 'transport',
    description: 'Use or recharge a transport IC card.',
    generationGuidance:
      'Teach a bounded exchange about obtaining, topping up, or resolving a simple use question for a transport IC card. Do not make cash amount recognition or ticket buying the central task.',
  },
  {
    id: 'transport.take_a_taxi',
    category: 'transport',
    description: 'Tell a taxi driver the destination and handle the basic ride exchange.',
    generationGuidance:
      'Teach stating or showing a destination, confirming the destination, and one simple ride request. Keep street-navigation instructions, detailed fare negotiation, and public-transport ticketing outside the goal.',
  },
  {
    id: 'transport.handle_a_delay_or_cancellation',
    category: 'transport',
    description: 'Ask about a transport delay or cancellation and the next option.',
    generationGuidance:
      'Teach how to confirm whether a named service is delayed or cancelled and ask for the next available option. Keep ordinary schedule checking and transfer navigation distinct.',
  },
  {
    id: 'shopping.ask_for_and_find_an_item',
    category: 'shopping',
    description: 'Ask whether a shop has an item and where to find it.',
    generationGuidance:
      'Teach a shop-floor exchange for naming or describing one product, checking availability, and understanding its location. Do not make price, size comparison, or checkout the main task.',
  },
  {
    id: 'shopping.ask_and_understand_a_price',
    category: 'shopping',
    description: 'Ask the price of an item and understand the answer.',
    generationGuidance:
      'Teach a product-specific price exchange, including asking how much an item costs and confirming the quoted amount. Keep portable number literacy and the final purchase transaction outside the main goal.',
  },
  {
    id: 'shopping.compare_sizes_colors_and_variants',
    category: 'shopping',
    description: 'Ask for a different size, color, or product variant.',
    generationGuidance:
      'Teach how to ask whether the same item is available in one different size, color, model, or variant and understand the answer. Keep trying clothing on and locating a different product distinct.',
  },
  {
    id: 'shopping.try_on_clothing',
    category: 'shopping',
    description: 'Ask to try on clothing and understand fitting-room instructions.',
    generationGuidance:
      'Teach permission to try on an item and one or two fitting-room directions or responses. Keep size availability and the purchase decision as supporting context rather than the central task.',
  },
  {
    id: 'shopping.request_a_quantity_and_purchase',
    category: 'shopping',
    description: 'Request a quantity of an item and complete a basic shop purchase.',
    generationGuidance:
      'Teach selecting a known item in a specific quantity and completing a simple checkout exchange. Do not duplicate restaurant ordering, price discovery, or tax-free paperwork as the main goal.',
  },
  {
    id: 'shopping.complete_a_tax_free_purchase',
    category: 'shopping',
    description: 'Ask about and complete the basic steps of a tax-free purchase.',
    generationGuidance:
      'Teach a bounded tourist-shopping exchange about tax-free eligibility and the required passport or counter. Keep detailed legal rules out of the lesson and do not reduce the goal to ordinary checkout.',
  },
  {
    id: 'shopping.exchange_or_return_an_item',
    category: 'shopping',
    description: 'Ask to exchange or return a purchased item.',
    generationGuidance:
      'Teach stating one simple problem with a recent purchase and asking whether an exchange or return is possible. Keep initial product comparison and buying outside the central task.',
  },
  {
    id: 'directions.ask_the_way_to_a_destination',
    category: 'directions',
    description: 'Ask how to get to a named destination.',
    generationGuidance:
      'Teach initiating a directions exchange by naming a destination and asking the way. The reply may be brief, but detailed route-step comprehension belongs to its own objective.',
  },
  {
    id: 'directions.understand_route_instructions',
    category: 'directions',
    description: 'Understand a short sequence of route instructions.',
    generationGuidance:
      'Teach comprehension of a compact walking route using turns, straight ahead, crossings, or landmarks. Keep the goal on following the instructions rather than merely asking where a place is.',
  },
  {
    id: 'directions.confirm_a_location_on_a_map',
    category: 'directions',
    description: 'Confirm the current location or a destination on a map.',
    generationGuidance:
      'Teach a map-supported exchange for asking where the learner is now or having a destination indicated. Keep spoken turn-by-turn directions and building-floor navigation outside the main goal.',
  },
  {
    id: 'directions.find_an_entrance_exit_or_floor',
    category: 'directions',
    description: 'Find the correct entrance, exit, or floor within a place.',
    generationGuidance:
      'Teach navigation inside a station, building, attraction, or complex by asking for an entrance, exit, elevator, or floor and understanding the concise answer. Do not broaden into a route across town.',
  },
  {
    id: 'directions.ask_about_distance_and_travel_time',
    category: 'directions',
    description: 'Ask how far away a place is or how long it takes to reach.',
    generationGuidance:
      'Teach checking walking distance or approximate travel time to a named destination and understanding a practical answer. Keep clock-time schedules and detailed route instructions distinct.',
  },
  {
    id: 'directions.recover_when_lost',
    category: 'directions',
    description: 'Explain that you are lost and check the correct direction.',
    generationGuidance:
      'Teach a repair exchange for saying the learner is lost or may be going the wrong way and confirming the next direction. Use a fresh recovery context rather than repeating an ordinary directions request.',
  },
  {
    id: 'hotel_accommodation.check_in_with_a_reservation',
    category: 'hotel_accommodation',
    description: 'Check in to accommodation using a reservation.',
    generationGuidance:
      'Teach an arrival exchange for stating that the learner has a reservation, giving the reservation name, and understanding one basic check-in request. Keep room problems and reservation changes outside the goal.',
  },
  {
    id: 'hotel_accommodation.check_out_and_settle_charges',
    category: 'hotel_accommodation',
    description: 'Check out and confirm or settle accommodation charges.',
    generationGuidance:
      'Teach announcing checkout, confirming the final amount or an unfamiliar charge, and completing the closing exchange. Keep generic payment literacy and room-problem reporting distinct.',
  },
  {
    id: 'hotel_accommodation.ask_about_amenities_and_hours',
    category: 'hotel_accommodation',
    description: 'Ask whether an accommodation amenity is available and when it is open.',
    generationGuidance:
      'Teach asking about one facility or included service such as breakfast, laundry, a bath, or a gym and understanding its location or hours. Do not turn the goal into requesting delivery to the room.',
  },
  {
    id: 'hotel_accommodation.request_a_room_item_or_service',
    category: 'hotel_accommodation',
    description: 'Request an item or simple service for the room.',
    generationGuidance:
      'Teach requesting one needed item or ordinary service such as an extra towel, cleaning, or a wake-up call. Keep fault reporting and amenity-information questions outside the main task.',
  },
  {
    id: 'hotel_accommodation.report_a_room_problem',
    category: 'hotel_accommodation',
    description: 'Report a problem with the room and ask for help.',
    generationGuidance:
      'Teach clearly naming one room fault such as heating, noise, plumbing, or a missing working feature and asking staff to resolve it. Keep routine item requests and reservation changes distinct.',
  },
  {
    id: 'hotel_accommodation.store_luggage',
    category: 'hotel_accommodation',
    description: 'Ask accommodation staff to store luggage before or after a stay.',
    generationGuidance:
      'Teach a focused luggage-storage exchange, including whether storage is possible and when the learner will return. Keep check-in and checkout as supporting context rather than reteaching them.',
  },
  {
    id: 'hotel_accommodation.change_a_reservation_or_stay',
    category: 'hotel_accommodation',
    description: 'Request a simple change to an accommodation reservation or stay.',
    generationGuidance:
      'Teach asking to change one booking detail such as the date, number of nights, room type, or guest count and understanding whether it is possible. Do not duplicate ordinary check-in.',
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

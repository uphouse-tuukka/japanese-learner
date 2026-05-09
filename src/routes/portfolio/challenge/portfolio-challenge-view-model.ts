export type PortfolioScenarioOption = {
  id: string;
  label: string;
  emoji: string;
};

export type PortfolioProgressDisplay = {
  current: number;
  total: number;
  label: string;
};

export type PortfolioSummaryStatsForDisplay = {
  accuracy?: number;
  totalCorrect: number;
  totalExercises: number;
  scenario?: string | null;
  phrasesLearned?: readonly string[] | null;
};

export type PortfolioSummaryStatRow = {
  label: string;
  value: string;
};

export const PORTFOLIO_SCENARIOS = [
  { id: 'food', label: 'Food & Dining', emoji: '🍜' },
  { id: 'directions', label: 'Asking Directions', emoji: '🗺️' },
  { id: 'hotel', label: 'Hotel Check-in', emoji: '🏨' },
  { id: 'transport', label: 'Getting Around', emoji: '🚃' },
  { id: 'greetings', label: 'Greetings & Basics', emoji: '👋' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
] as const satisfies readonly PortfolioScenarioOption[];

export const PORTFOLIO_LOADING_MESSAGES = [
  'Your sensei is preparing today’s lesson…',
  'Brewing green tea for the session… 🍵',
  'Arranging the study materials…',
  'Writing today’s lesson plan…',
  'Almost ready…',
] as const;

export const PORTFOLIO_JAPAN_FACTS: readonly string[] = [
  'Japan has over 14,000 islands, though only a few hundred are inhabited.',
  'Tokyo has more Michelin-starred restaurants than any other city in the world.',
  'Shinkansen bullet trains are known for average delays measured in seconds, not minutes.',
  'In Japan, convenience stores often offer high-quality fresh meals and local specialties.',
  'You can soak in natural onsen hot springs in many regions, from mountain towns to seaside areas.',
  'Spring cherry blossom forecasts are followed nationwide and influence travel planning.',
  'Nara is famous for free-roaming deer considered messengers in local Shinto tradition.',
  'Japanese depachika food halls in department store basements are popular for gourmet takeout.',
  'Many Japanese cities install decorative manhole covers featuring local history and mascots.',
  'Hokkaido is especially known for powder snow and winter festivals with ice sculptures.',
  'Okinawa has a distinct culture, cuisine, and history compared with mainland Japan.',
  'Traditional yukata are commonly worn at summer festivals and fireworks events.',
  'Kyoto was Japan’s capital for more than 1,000 years.',
  'Some ryokan inns serve multi-course kaiseki meals focused on local seasonal ingredients.',
  'Japanese tea ceremonies emphasize hospitality, mindfulness, and precise ritual.',
];

export function buildPortfolioProgressDisplay(
  currentIndex: number,
  totalExercises: number,
): PortfolioProgressDisplay {
  const current = Math.min(currentIndex + 1, Math.max(totalExercises, 1));
  const total = totalExercises;
  return {
    current,
    total,
    label: `${current} / ${total}`,
  };
}

export function resolvePortfolioScenarioLabel(
  selectedScenario: string | null,
  summaryScenario: string | null | undefined,
): string {
  return (
    PORTFOLIO_SCENARIOS.find((scenario) => scenario.id === selectedScenario)?.label ??
    summaryScenario ??
    'Travel'
  );
}

export function buildPortfolioSummaryStatRows(
  stats: PortfolioSummaryStatsForDisplay,
  selectedScenario: string | null,
): PortfolioSummaryStatRow[] {
  return [
    { label: 'Correct answers', value: `${stats.totalCorrect} / ${stats.totalExercises}` },
    { label: 'Scenario', value: resolvePortfolioScenarioLabel(selectedScenario, stats.scenario) },
    { label: 'Phrases learned', value: String(stats.phrasesLearned?.length ?? 0) },
  ];
}

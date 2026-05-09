import { describe, expect, it } from 'vitest';
import {
  PORTFOLIO_JAPAN_FACTS,
  PORTFOLIO_LOADING_MESSAGES,
  PORTFOLIO_SCENARIOS,
  buildPortfolioProgressDisplay,
  buildPortfolioSummaryStatRows,
  resolvePortfolioScenarioLabel,
} from './portfolio-challenge-view-model';

describe('portfolio challenge view-model helpers', () => {
  it('keeps the scenario picker labels and emoji in the existing order', () => {
    expect(PORTFOLIO_SCENARIOS).toEqual([
      { id: 'food', label: 'Food & Dining', emoji: '🍜' },
      { id: 'directions', label: 'Asking Directions', emoji: '🗺️' },
      { id: 'hotel', label: 'Hotel Check-in', emoji: '🏨' },
      { id: 'transport', label: 'Getting Around', emoji: '🚃' },
      { id: 'greetings', label: 'Greetings & Basics', emoji: '👋' },
      { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
    ]);
  });

  it('preserves the loading copy rotation order', () => {
    expect(PORTFOLIO_LOADING_MESSAGES).toEqual([
      'Your sensei is preparing today’s lesson…',
      'Brewing green tea for the session… 🍵',
      'Arranging the study materials…',
      'Writing today’s lesson plan…',
      'Almost ready…',
    ]);
  });

  it('preserves the Japan fact rotation copy', () => {
    expect(PORTFOLIO_JAPAN_FACTS).toEqual([
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
    ]);
  });

  it('builds the existing progress bar display values', () => {
    expect(buildPortfolioProgressDisplay(0, 4)).toEqual({
      current: 1,
      total: 4,
      label: '1 / 4',
    });
    expect(buildPortfolioProgressDisplay(99, 4)).toEqual({
      current: 4,
      total: 4,
      label: '4 / 4',
    });
    expect(buildPortfolioProgressDisplay(0, 0)).toEqual({
      current: 1,
      total: 0,
      label: '1 / 0',
    });
  });

  it('resolves selected scenario labels before summary fallbacks', () => {
    expect(resolvePortfolioScenarioLabel('hotel', 'Fallback scenario')).toBe('Hotel Check-in');
    expect(resolvePortfolioScenarioLabel('unknown', 'Fallback scenario')).toBe('Fallback scenario');
    expect(resolvePortfolioScenarioLabel(null, undefined)).toBe('Travel');
  });

  it('builds the summary stats rows shown in the completion card', () => {
    expect(
      buildPortfolioSummaryStatRows(
        {
          accuracy: 75,
          totalCorrect: 3,
          totalExercises: 4,
          scenario: 'Food fallback',
          phrasesLearned: ['すみません', 'お願いします'],
        },
        'food',
      ),
    ).toEqual([
      { label: 'Correct answers', value: '3 / 4' },
      { label: 'Scenario', value: 'Food & Dining' },
      { label: 'Phrases learned', value: '2' },
    ]);
  });
});

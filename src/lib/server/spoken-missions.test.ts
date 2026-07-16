import { describe, expect, it } from 'vitest';
import {
  getSpokenMissionDefinition,
  listSpokenMissionIds,
  selectSpokenMissionVariant,
  toSpokenMissionBriefing,
} from './spoken-missions';

describe('spoken mission definitions', () => {
  it('configures only Order at a Restaurant with the complete authored Can-do contract', () => {
    expect(listSpokenMissionIds()).toEqual(['mission-order-restaurant']);

    const definition = getSpokenMissionDefinition('mission-order-restaurant');
    expect(definition).toMatchObject({
      version: 'restaurant-order-v2',
      canDo: 'I can manage a short order conversation in a restaurant.',
      approximateMinutes: 2,
      maxRecordingSeconds: 12,
    });
    expect(definition?.briefing).toMatchObject({
      situation: expect.stringContaining('restaurant'),
      assessment: expect.stringContaining('accent'),
      evidence: expect.stringContaining('Independent'),
      privacy: expect.stringContaining('discarded'),
    });
    expect(definition?.goals.map((goal) => goal.key)).toEqual(['order', 'respond', 'repair']);
    expect(definition?.goals.every((goal) => goal.serverLines.length >= 2)).toBe(true);
    expect(definition?.goals.every((goal) => goal.alternatives.length >= 2)).toBe(true);
    expect(definition?.goals.every((goal) => goal.rubric.length > 0)).toBe(true);
    expect(getSpokenMissionDefinition('mission-first-meeting')).toBeNull();
  });

  it('serializes the complete learner-safe evidence explanation from the production definition', () => {
    const definition = getSpokenMissionDefinition('mission-order-restaurant');
    if (!definition) throw new Error('Expected restaurant Spoken Mission definition.');

    const briefing = toSpokenMissionBriefing(definition);

    expect(briefing.canDo).toBe('I can manage a short order conversation in a restaurant.');
    expect(briefing.goals).toEqual([
      { key: 'order', title: 'Order' },
      { key: 'respond', title: 'Respond' },
      { key: 'repair', title: 'Repair' },
    ]);
    expect(briefing.evidence).toContain('Independent evidence');
    expect(briefing.evidence).toContain('Supported evidence');
    expect(briefing.privacy).toContain('Transcripts and semantic assessments are retained');
    expect(briefing.privacy).toContain('Raw audio is discarded');
  });

  it('avoids the immediately previous authored wording when another variant exists', () => {
    const definition = getSpokenMissionDefinition('mission-order-restaurant');
    if (!definition) throw new Error('Expected restaurant Spoken Mission definition.');

    expect(selectSpokenMissionVariant(definition, 0, () => 0)).toBe(1);
    expect(selectSpokenMissionVariant(definition, null, () => 0.99)).toBe(1);
  });
});

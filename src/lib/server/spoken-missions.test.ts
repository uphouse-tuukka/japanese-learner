import { describe, expect, it } from 'vitest';
import {
  getSpokenMissionDefinition,
  listSpokenMissionIds,
  selectSpokenMissionVariant,
  toSpokenMissionBriefing,
  toSpokenMissionResult,
} from './spoken-missions';

describe('spoken mission definitions', () => {
  it('configures only Order at a Restaurant with the complete authored Can-do contract', () => {
    expect(listSpokenMissionIds()).toEqual(['mission-order-restaurant']);

    const definition = getSpokenMissionDefinition('mission-order-restaurant');
    expect(definition).toMatchObject({
      version: 'restaurant-order-v3',
      supersededVersions: ['restaurant-order-v1', 'restaurant-order-v2'],
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
    expect(
      definition?.goals.every(
        (goal) =>
          goal.retrySuggestion.japanese.length > 0 && goal.retrySuggestion.romaji.length > 0,
      ),
    ).toBe(true);
    expect(
      definition?.goals.every(
        (goal) => !Object.prototype.hasOwnProperty.call(goal.retrySuggestion, 'english'),
      ),
    ).toBe(true);
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

  it('returns a discriminated incomplete result with accepted and skipped goals', () => {
    const definition = getSpokenMissionDefinition('mission-order-restaurant');
    if (!definition) throw new Error('Expected restaurant Spoken Mission definition.');

    const result = toSpokenMissionResult(definition, {
      id: 'spokenmission-incomplete',
      userId: 'user-1',
      missionId: definition.missionId,
      definitionVersion: definition.version,
      status: 'incomplete',
      currentTurn: 3,
      supportUsed: false,
      currentTurnSupportUsed: false,
      currentTurnWrittenSupportRevealed: false,
      successfulTurnCount: 2,
      wordingVariant: 0,
      conversationLog: [
        {
          kind: 'skipped',
          goalKey: 'order',
          turnNumber: 1,
          npcJapanese: 'ご注文はお決まりですか。',
          npcRomaji: 'go-chuumon wa okimari desu ka.',
          supportUsed: false,
          writtenSupportRevealed: false,
          clientSkipId: 'skip-1',
          skippedAt: '2026-07-17T09:00:00.000Z',
        },
        ...(['respond', 'repair'] as const).map((goalKey, index) => ({
          goalKey,
          turnNumber: index + 2,
          npcJapanese: '日本語',
          npcRomaji: 'nihongo',
          transcript: '返事',
          outcome: 'accepted' as const,
          confidence: 'high' as const,
          feedback: 'Accepted.',
          supportUsed: false,
          clientResponseId: `accepted-${index + 2}`,
          assessedAt: '2026-07-17T09:01:00.000Z',
        })),
      ],
      evidenceState: null,
      completedAt: '2026-07-17T09:02:00.000Z',
      createdAt: '2026-07-17T09:00:00.000Z',
      updatedAt: '2026-07-17T09:02:00.000Z',
    });

    expect(result).toEqual({
      kind: 'incomplete',
      canDo: definition.canDo,
      goals: [
        { goalKey: 'order', title: 'Order', status: 'skipped' },
        { goalKey: 'respond', title: 'Respond', status: 'accepted' },
        { goalKey: 'repair', title: 'Repair', status: 'accepted' },
      ],
    });
  });
});

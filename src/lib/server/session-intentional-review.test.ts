import { describe, expect, it } from 'vitest';
import {
  detectIntentionalReviewTransferContextIds,
  selectIntentionalReviewTransferContext,
} from './session-intentional-review';

describe('intentional review transfer contexts', () => {
  it('recognizes semantic aliases from the complete original lesson treatment', () => {
    expect(
      detectIntentionalReviewTransferContextIds(
        'Exchange origins with a traveler while waiting inside a railway terminal.',
      ),
    ).toEqual(['station_encounter']);
  });

  it('selects a context absent from complete treatment evidence', () => {
    expect(
      selectIntentionalReviewTransferContext({
        identity: 'exchanging origins',
        display: 'Exchanging origins',
        originalTreatmentContextIds: ['station_encounter'],
        treatmentEvidenceComplete: true,
      })?.id,
    ).toBe('hotel_lobby');
  });

  it('fails closed when complete original treatment evidence is unavailable', () => {
    expect(
      selectIntentionalReviewTransferContext({
        identity: 'exchanging origins',
        display: 'Exchanging origins',
        originalTreatmentContextIds: [],
        treatmentEvidenceComplete: false,
      }),
    ).toBeNull();
  });
});

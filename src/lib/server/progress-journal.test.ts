import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLogWarn, mockRecordUsageEvent, mockUpdateProgressJournalIfCurrent } = vi.hoisted(
  () => ({
    mockLogWarn: vi.fn(),
    mockRecordUsageEvent: vi.fn(),
    mockUpdateProgressJournalIfCurrent: vi.fn(),
  }),
);

vi.mock('$lib/server/db', () => ({
  updateProgressJournalIfCurrent: mockUpdateProgressJournalIfCurrent,
}));

vi.mock('$lib/server/token-limiter', () => ({
  recordUsageEvent: mockRecordUsageEvent,
}));

vi.mock('$lib/server/logger', () => ({
  logWarn: mockLogWarn,
}));

import { persistGeneratedJournal } from './progress-journal';

const input = {
  userId: 'user-1',
  sessionId: 'session-1',
  currentJournal: 'Source journal',
  journal: 'Generated journal',
  tokenUsage: {
    model: 'gpt-5.4',
    tokensIn: 10,
    tokensOut: 20,
  },
};

describe('persistGeneratedJournal', () => {
  beforeEach(() => {
    mockLogWarn.mockReset();
    mockRecordUsageEvent.mockReset().mockResolvedValue(undefined);
    mockUpdateProgressJournalIfCurrent.mockReset().mockResolvedValue(true);
  });

  it('persists against the source snapshot and records generation usage', async () => {
    await persistGeneratedJournal(input);

    expect(mockUpdateProgressJournalIfCurrent).toHaveBeenCalledWith(
      'user-1',
      'Source journal',
      'Generated journal',
    );
    expect(mockRecordUsageEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      model: 'gpt-5.4',
      tokensIn: 10,
      tokensOut: 20,
    });
    expect(mockLogWarn).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer journal and emits sanitized stale-update diagnostics', async () => {
    mockUpdateProgressJournalIfCurrent.mockResolvedValueOnce(false);

    await persistGeneratedJournal(input);

    expect(mockRecordUsageEvent).toHaveBeenCalledOnce();
    expect(mockLogWarn).toHaveBeenCalledWith('progress-journal', 'skipped stale journal update', {
      sessionId: 'session-1',
      userId: 'user-1',
    });
  });

  it('records provider usage even when journal persistence fails', async () => {
    const persistenceError = new Error('database unavailable');
    mockUpdateProgressJournalIfCurrent.mockRejectedValueOnce(persistenceError);

    await expect(persistGeneratedJournal(input)).rejects.toBe(persistenceError);

    expect(mockRecordUsageEvent).toHaveBeenCalledOnce();
  });

  it('attempts journal persistence even when usage accounting fails', async () => {
    const usageError = new Error('telemetry unavailable');
    mockRecordUsageEvent.mockRejectedValueOnce(usageError);

    await expect(persistGeneratedJournal(input)).rejects.toBe(usageError);

    expect(mockUpdateProgressJournalIfCurrent).toHaveBeenCalledOnce();
  });
});

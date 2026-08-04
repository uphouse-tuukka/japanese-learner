import { updateProgressJournalIfCurrent } from '$lib/server/db';
import { logWarn } from '$lib/server/logger';
import { recordUsageEvent } from '$lib/server/token-limiter';

type GeneratedJournalInput = {
  userId: string;
  sessionId: string;
  currentJournal: string | null;
  journal: string;
  tokenUsage: {
    model: string;
    tokensIn: number;
    tokensOut: number;
  };
};

export async function persistGeneratedJournal(input: GeneratedJournalInput): Promise<void> {
  const persistence = input.journal.trim()
    ? updateProgressJournalIfCurrent(input.userId, input.currentJournal, input.journal)
    : Promise.resolve(true);
  const usage = recordUsageEvent({
    userId: input.userId,
    sessionId: input.sessionId,
    model: input.tokenUsage.model,
    tokensIn: input.tokenUsage.tokensIn,
    tokensOut: input.tokenUsage.tokensOut,
  });
  const [persistenceResult, usageResult] = await Promise.allSettled([persistence, usage]);

  if (persistenceResult.status === 'fulfilled' && !persistenceResult.value) {
    logWarn('progress-journal', 'skipped stale journal update', {
      sessionId: input.sessionId,
      userId: input.userId,
    });
  }

  const failures = [persistenceResult, usageResult]
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => result.reason);
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Progress journal persistence and usage accounting failed.');
  }
}

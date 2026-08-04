# Decision: Durable Learning Journal updates

**Date:** 2026-08-04

**Status:** decided

## Context

Learning Session and Practice completion previously started journal generation through an untracked promise after the completed session was durable.
Vercel may suspend or terminate a function invocation after the response, so that promise did not guarantee journal generation, persistence, or token accounting would finish.
Closely timed completions also generated from the same stored journal value and then overwrote it unconditionally, which allowed an older generated result to replace newer Learning Journal state.

The Learning Journal is advisory and must remain non-fatal.
Completed-session metadata remains authoritative Coverage Evidence even when journal work fails.

## Decision

Use the official `@vercel/functions` `waitUntil` helper to register the complete guarded journal task with the Vercel Node.js Function lifecycle.
The task includes generation, conditional persistence, and provider token accounting.
When the application is not running on Vercel, await the same guarded task before returning because no supported durable deferred boundary is available.

Persist a generated journal only when the current stored journal still exactly matches the snapshot used to generate it.
Treat a mismatch as a stale update, keep the newer stored journal, record sanitized diagnostics, and still account for provider token usage.

Official runtime references:

- Vercel documents `waitUntil` as extending a request handler's lifetime for the supplied promise: <https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package>
- Vercel identifies `@vercel/functions` as the supported replacement for the deprecated request context API: <https://vercel.com/docs/functions/functions-api-reference?framework=other>

## Alternatives considered

| Alternative                                          | Pros                                          | Cons                                                                                        |
| ---------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Await every journal update on every runtime          | Simple lifecycle guarantee                    | Adds the full model and database latency to production completion responses                 |
| Keep the untracked promise                           | No response latency                           | Can be abandoned after response and does not satisfy the deployed runtime contract          |
| Add a durable external job queue                     | Strong retry and delivery semantics           | Adds infrastructure beyond the needs of this personal application and this ticket           |
| Use the adapter's `event.platform.context.waitUntil` | Available on the deprecated Edge context type | The project uses the default Node.js runtime, and the adapter marks this context deprecated |

## Rationale

The official Vercel helper matches the deployed Node.js runtime and keeps learner-facing completion responsive while giving the platform ownership of the task lifetime.
Awaiting on unsupported runtimes preserves correctness during local development and alternative deployment.
Compare-and-swap persistence is the smallest robust concurrency boundary because it prevents lost updates without introducing a new queue or journal revision schema.

## Consequences

- Production completion can return after the journal task is registered, while Vercel keeps the invocation alive within the configured function duration.
- Non-Vercel completion waits for journal work, but failures remain logged and non-fatal.
- Two completions derived from the same journal snapshot cannot both overwrite the stored journal.
- Token accounting is attempted independently from journal persistence after a successful provider response.
- A failed or stale journal update is not retried automatically.

## Follow-up tasks

- [ ] Revisit a durable queue only if journal delivery retries become valuable enough to justify additional infrastructure.

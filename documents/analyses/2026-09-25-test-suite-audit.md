# Test suite audit

Date: 2026-09-25

## Summary

The suite provides broad protection for the application's Learning Session, Practice, mission, persistence, AI, and browser interaction boundaries.
The unmodified baseline executed 689 passing test cases across 78 files in 10.62 seconds with Vitest's verbose reporter.
No skipped, focused, or undiscovered test files were found in the configured source tree.

The highest-value remediation is in the speaking assessment cluster.
Seven tests in the Learn and Practice compatibility adapter repeat audio validation, token accounting, and prompt construction already owned by the shared voice assessment implementation, while the learner-facing HTTP route does not directly verify its three safe client-error responses.
Moving protection to the owning shared seam and the public HTTP seam reduces duplication while improving confidence in observable API behavior.

## Scope and method

The audit inspected the 78 discovered Vitest files, their test-case distribution, the CI workflow, package scripts, repository engineering guidance, active architecture documentation, and test history around suspicious overlaps.
The deepest source-and-test traces covered Learning Session generation and completion, session coverage evidence, Spoken Mission browser and persistence flows, speaking assessment, database schema and migrations, selected-user authorization, AI prompt contracts, and architecture guardrails.

The public seams selected for remediation are `assessMissionVoiceTurn` and the exported transcription behavior in `voice-assessment.ts`, the `checkSpeakingAnswer` compatibility result, and `POST /api/speaking/check`.
These are existing caller-visible boundaries, so no production-only testing hook is needed.

The audit used test names, assertions, production callers, and commit history rather than coverage percentages.
It did not use live OpenAI services, microphone hardware, or browser acceptance because this task changes test ownership without changing product behavior.

## Prioritised findings recorded before remediation

### P1: Speaking compatibility tests duplicate the shared voice implementation

- Locations: `src/lib/server/speaking-checker.test.ts` and `src/lib/server/voice-assessment.test.ts`.
- Cost: the compatibility suite recreates the OpenAI client boundary and reasserts audio size/type validation, transcription token accounting, duration-only usage handling, and shared prompt text.
- Concrete failure mode: a shared voice refactor can require parallel mechanical changes in both files even when the compatibility result is unchanged, while an adapter-specific regression can be obscured by shared implementation assertions.
- Evidence: commit `a3b0c50` extracted `voice-assessment.ts` but retained the earlier provider-level compatibility tests; the adapter now primarily maps shared results and selected errors.
- Recommendation: keep the compatibility success mapping and invalid-assessment fallback, move any missing shared assertions to `voice-assessment.test.ts`, and remove the seven overlapping adapter cases.
- Remaining protection after removal: audio validation, provider requests, prompts, usage accounting, missing speech, and assessment failures remain at the shared voice seam; adapter output and recovery remain at the adapter seam.
- Result: implemented.
  Seven overlapping adapter cases were removed while adapter success and recovery behavior remain protected.

### P1: The speaking HTTP route lacks direct safe-error response coverage

- Location: `src/routes/api/speaking/check.server.test.ts`.
- Missed regression: `audio_too_large`, `unsupported_audio_type`, or `empty_transcript` could accidentally become a generic 500 response or expose an unsafe message even though lower-level tests remain green.
- Evidence: the route tests authentication, request parsing, budget failure, success, and unexpected errors, but no expected `SpeakingCheckError` branch.
- Recommendation: add one public-route case for each distinct status/message contract without parameterising the cases.
- Result: implemented with three independent route cases that exercise the real compatibility adapter while mocking only the shared voice boundary.
  Each case proves the corresponding `VoiceAssessmentError` is mapped through `checkSpeakingAnswer` to the route's safe 400 response.

### P2: Shared voice coverage should own size and usage-shape behavior explicitly

- Location: `src/lib/server/voice-assessment.test.ts`.
- Missed regression: removing the adapter duplicates without replacement would leave maximum audio size and duration-only usage accounting indirectly or incompletely protected.
- Recommendation: add an oversized-audio case at the shared mission seam and strengthen the existing accepted-path assertions for exact token usage and prompt safety; add a direct exported transcription case for duration-only usage.
- Result: implemented.
  The accepted shared path now verifies exact token events and the safety-critical prompt rails, and dedicated cases cover oversized audio and duration-only transcription usage.

### P3: Source-text schema assertions look suspicious but protect distinct contracts

- Locations: `src/lib/server/db-schema.test.ts`, `src/lib/server/spoken-missions-schema.test.ts`, and database integration tests.
- Evidence: executable database tests prove SQL validity and important Spoken Mission constraints, while the source-text tests separately inventory required core tables and indexes that are not all queried by one integration test.
- Recommendation: retain these tests.
  Replacing them in this task would either weaken the inventory contract or expand into a database harness redesign.
- Status before implementation: rejected as a removal candidate.

### P3: Exact AI model assertions are deliberate configuration tripwires

- Location: `src/lib/server/ai-models.test.ts`.
- Evidence: the constants were centralized with their tests in commit `e382f6f`, and the model identifiers affect provider capability, cost, and prompt behavior even though the assertions are small.
- Recommendation: retain the two cases as explicit configuration review points.
- Status before implementation: rejected as a removal candidate.

### P3: Repeated selected-user checks protect independent route contracts

- Locations: profile-scoped route tests and `src/lib/server/selected-user.test.ts`.
- Evidence: the helper tests normalization and matching, while each route test proves authorization happens before that route's writes or external work.
- Recommendation: retain the route-level cases.
  Shared helper coverage is not equivalent to proving each endpoint invokes the helper at the correct point.
- Status before implementation: rejected as a removal candidate.

## Valuable tests retained

The large Learning Session generation, completion, and coverage-evidence suites exercise distinct curriculum, retry, persistence, and idempotency failures and should not be collapsed based on file size alone.
The browser-like Spoken Mission journeys remain valuable because they cover asynchronous support disclosure, stale response handling, recovery, and evidence outcomes through rendered behavior.
The exercise UI source-contract suite remains a deliberate architecture guardrail documented by the repository's exercise UI guidance.

## Verification plan

Run the focused speaking assessment and API route files after remediation.
Then run `npm run check`, the complete Vitest suite with the same verbose counting method, and `npm run validate:ci`.
Record the final executed test count and exact checks here after implementation.

## Implementation and verification results

The final suite executes 687 passing cases across the same 78 files, compared with the 689-case baseline.
The two-case net reduction uses the same Vitest verbose-reporter count before and after.
No test was skipped, hidden through parameterisation, or weakened to obtain the reduction.

Meaningful coverage improved at the learner-facing HTTP boundary.
The suite now proves the distinct safe 400 responses for oversized audio, unsupported audio, and missing speech, including that provider-specific details are not returned.
Those route cases traverse the compatibility adapter, so regressions in `VoiceAssessmentError` to `SpeakingCheckError` mapping cannot be masked by directly injecting the post-mapping error.
Shared voice tests now directly own maximum-size validation, duration-only usage behavior, exact token accounting, transcription guardrails, and semantic assessment guardrails.

Checks run:

- `npm test -- src/lib/server/speaking-checker.test.ts src/lib/server/voice-assessment.test.ts src/routes/api/speaking/check.server.test.ts`: 3 files and 22 tests passed.
- `npm run check`: passed with 0 errors and 0 warnings.
- `npm test -- --reporter=verbose`: 78 files and 687 tests passed in 10.48 seconds.
- `npm run validate:ci`: passed, including formatting, type checks, lint, 687 tests, and the production build.

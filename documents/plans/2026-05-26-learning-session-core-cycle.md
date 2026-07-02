# Learning Session Core Cycle — Plan

## Problem

After real use, Learning Sessions still feel repetitive. Topic Categories rotate, but often return to recently used categories, and Lesson Key Phrases such as “sumimasen” keep appearing. The likely failure is not just category rotation; the generator does not have high-fidelity enough evidence of what the learner has already covered, so it falls back to basic travel Japanese.

Scope: improve the existing Learning Session feature. Do not add new user-facing features.

## Current finding

The current implementation samples only a limited slice of prior sessions for generation context. `src/routes/api/session/generate/+server.ts` reads recent session summaries and passes `sessionHistory`, `coveredTopics`, `categoryRotation`, and performance insights into `generateSessionPlan()`. It does not read `progress_journal` or pass the Learning Journal into the session generator.

The Learning Journal is currently used during session completion: `src/routes/api/session/complete/+server.ts` gives it to the summary prompt, then updates it in a background task after the completed session. That means the journal can accumulate useful learner history, but it is not part of the next Learning Session’s category, topic, or Lesson Key Phrase selection. The generator therefore falls back to recent metadata plus safe beginner defaults.

## Accepted decision: high-fidelity session generation context

The next design should keep session generation high fidelity rather than trying to solve repetition with a small recency sample alone.

Accepted direction:

- The generator must receive explicit Coverage Evidence about covered Topic Categories, Lesson Topics, and Lesson Key Phrases.
- Coverage Evidence from completed session metadata is authoritative for exact “what has been covered” decisions.
- The Learning Journal remains as advisory tutor memory for semantic continuity, persistent weak spots, and pedagogical interpretation.
- The app should resolve a single target Topic Category from app-side rotation and Coverage Evidence before the model chooses the exact Lesson Topic and phrases.
- Normal category depth is 2 consecutive Learning Sessions; a 3rd consecutive session is allowed only when Coverage Evidence or tutor guidance shows it is clearly useful.
- After 3 consecutive sessions in one Topic Category, the next Learning Session must rotate to a different Topic Category.
- Repetition is allowed only when it is intentional review via a Review Candidate, not because the model lacks memory.
- Generated Lesson Key Phrases should not repeat covered phrases unless they are Review Candidates. As a pragmatic validation tolerance, one non-candidate repeated key phrase may be allowed; more than one should trigger rejection/retry.
- The fix should preserve the current Learning Session flow and avoid new user-facing surfaces.

Rationale: without a durable coverage signal, the model is incentivised to choose safe beginner material repeatedly. More prompt wording alone will not fix that reliably. A plain-text Learning Journal is also too fragile to be the sole exact coverage ledger because it can paraphrase, prune, or fail to update in the background.

Future notes:

- If metadata-derived Coverage Evidence becomes too slow, too hard to query, or too limited for richer adaptivity, a later refactor may introduce a dedicated internal `LearningState` or `CoverageLedger`.
- Review Candidates may later power a separate practice tool or practice-mode integration, but that is explicitly out of scope for this Learning Session fix.

Do not build either future direction now; keep this change inside the Learning Session cycle.

## Design questions to resolve

1. Resolved: Coverage Evidence from session metadata is authoritative; the Learning Journal is advisory semantic tutor memory.
2. Resolved: normal Topic Category depth is 2 consecutive Learning Sessions; a 3rd is allowed only when useful; after 3, rotation is mandatory and weakness becomes a Review Candidate rather than extending the category.
3. Resolved: Review Candidates are transient planning artifacts derived at session-generation time from Coverage Evidence plus advisory Learning Journal context. They are passed to the session-generation prompt and used by post-generation validation. They are not persisted as a new durable queue/table for now.
4. Resolved: coverage state should be deterministic app input first, with model interpretation allowed only inside those rails. The app decides category rotation, selects the single target Topic Category, sets avoid/review constraints, and performs violation checks; the model chooses the exact Lesson Topic, phrase set, and exercise shape inside that target category and those constraints.
5. Resolved: Coverage Evidence should be built from the whole parseable completed AI Learning Session history, not only the recent 10-session prompt window. The model should receive a compact structured snapshot rather than raw full history, balancing maximum useful coverage information against prompt clutter.
6. Resolved: Lesson Key Phrase repetition should use normalized phrase identity, not broad semantic similarity. The guard should catch direct repeats such as `すみません`, `sumimasen`, and `Sumimasen!`, but it should not block neighbouring phrases such as `失礼します` merely because they share a similar English use case.
7. Resolved: category rails should make 2 consecutive Learning Sessions in the same Topic Category the normal depth target. At streak 1, heavily prefer staying in the current Topic Category unless Coverage Evidence or tutor guidance strongly suggests rotation. At streak 2, rotation becomes preferred but a 3rd session is allowed for clear exceptions. At streak 3, the current Topic Category is blocked and the next Learning Session must rotate.
8. Resolved: post-generation curriculum validation should retry once, then fail closed with the normal user-facing generation error if the generated Learning Session still violates category or repetition rails. Server-side logs should record sanitized validation failure details so recurring failures can be debugged without exposing secrets or full learner content.
9. Resolved: future completed-session metadata should preserve structured Lesson Key Phrase details compatibly. Keep the existing legacy `keyPhrases: string[]` field, add optional structured phrase detail metadata for new completions, use structured details for Coverage Evidence when present, and fall back to legacy strings for old history.
10. Resolved: old weak or unparseable history should not get a fuzzy middle layer. Parseable legacy data is usable; unparseable data is ignored for hard coverage and validation. Do not add ad hoc text-mining of old summaries just to rescue incomplete history. The Learning Journal remains advisory only if it is already available as tutor context.
11. Resolved: Review Candidates require item-level weakness evidence, not broad session failure alone. Low session accuracy can raise attention, but it should not turn every phrase in that session into a Review Candidate if the phrase-level exercise was correct. Combine low accuracy and wrong-answer evidence by deriving Review Candidates from specific wrong or mixed exercise/phrase/topic evidence, plus explicit handoff or Learning Journal mentions.
12. Resolved: Lesson Topic repetition should use exact normalized Lesson Topic identity, not semantic neighbour matching. Exact covered Lesson Topic repeats should be rejected unless they are Review Candidates. Fresh neighbouring situations inside the same Topic Category are allowed when they create real new coverage. Do not add embeddings or fuzzy topic matching in this fix.
13. Resolved: model calls rejected by curriculum validation still count against token usage. Record usage for every model call that returns usage data; rejected attempts should use `sessionId: null`, while the successful final generation should be recorded against the created session. Do not create ghost or planned sessions just to attach rejected usage. If a call fails before returning usage, there is no reliable usage to record.
14. Resolved: structured Lesson Key Phrase details should come from the generated lesson, not from reconstructed exercises. Keep legacy `keyPhrases: string[]`, add optional sanitized `keyPhraseDetails` metadata for new completions, and have Coverage Evidence prefer those details. Fall back to legacy strings, then only as a last resort derive phrases from exercises.
15. Resolved: the current Learning Journal should be passed to session generation as advisory tutor context. Generation should receive the whole bounded journal rather than a separate model-generated excerpt, clearly labelled as semantic context and explicitly not authoritative Coverage Evidence. The Learning Journal update prompt and server-side storage should keep the journal compact enough that the whole stored journal can be passed safely.
16. Resolved: the app should choose a single target Topic Category deterministically before generation.
    The model should not decide whether to continue or rotate categories.
    Category selection should prefer normal Category Depth at streak 1, prefer rotation at streak 2 unless there is an explicit reason for a 3rd session, block the current Topic Category at streak 3+, and choose among candidate categories by never-visited, least-covered, oldest-seen, then the fixed beginner-friendly order as the tie-breaker.
    The current fixed order is `greetings_basics`, `travel_essentials`, `food_dining`, `transport`, `shopping`, `directions`, `hotel_accommodation`, `emergencies_health`, `social_conversation`, `sightseeing_culture`, and `bars_nightlife`.
17. Resolved: do not implement a broad Topic Category saturation heuristic in this fix. At streak 1, continue the current Topic Category by default. Rotate early only for a concrete reason: the current category is blocked by validation constraints, no viable fresh Lesson Topic remains after retry, or stronger item-level Review Candidate / handoff / Learning Journal evidence clearly requires another category. Treat saturation as a future concept unless a real topic taxonomy is introduced.

## Generation-time design

Build a transient coverage snapshot in `/api/session/generate` from completed AI Learning Session metadata across the whole parseable history, then pass a compact version into `generateSessionPlan()` and the session-generation prompt.

The snapshot should include:

- covered Topic Categories, Lesson Topics, and Lesson Key Phrases with recency/count information
- category rotation state, including the app-selected target Topic Category plus allowed/preferred/blocked category rationale
- avoid lists for covered topics, covered key phrases, and recently repeated cultural notes or micro-themes
- Review Candidates derived from weak patterns, handoff notes, low/mixed accuracy, and advisory Learning Journal context
- the current whole bounded Learning Journal as advisory semantic context, not exact coverage authority

To avoid prompt clutter, the generator should keep two layers:

- full deterministic Coverage Evidence retained app-side for validation and retry decisions
- compact prompt Coverage Evidence sent to the model, focused on category state, recent coverage, most repeated/high-risk covered Lesson Key Phrases, Review Candidates, and the whole bounded Learning Journal

The recent narrative `sessionHistory` can stay capped for tutor continuity, but exact coverage checks should use the full parseable snapshot. If the covered phrase/topic set grows too large for the prompt, truncate the model-facing avoid list by recency, frequency, and high-risk beginner defaults while still validating generated output against the full app-side set.

Completed-session metadata should preserve both legacy and structured phrase coverage:

- keep the existing `keyPhrases: string[]` field for old history and compatibility
- store optional structured Lesson Key Phrase details for new completions, including Japanese, romaji, English, and usage when available from the generated lesson
- the client should send structured phrase details from `lesson.keyPhrases` during session completion
- the server should sanitize, cap, and store those details rather than trusting arbitrary client payload shape
- Coverage Evidence should prefer structured phrase details when present
- Coverage Evidence should fall back to legacy phrase strings for older sessions
- legacy `keyPhrases` should remain populated from the best available phrase text: Japanese when present, otherwise romaji, otherwise English
- phrase reconstruction from exercises should be a last-resort fallback only; exercises are practice artifacts, not the authoritative Lesson Key Phrase list
- this remains internal metadata inside the existing session summary JSON and does not require a DB migration or user-facing change

Deterministic app-side inputs and checks should include:

- current Topic Category streak
- app-selected target Topic Category and the reason it was selected
- whether the next Learning Session must rotate Topic Category
- allowed, preferred, and blocked Topic Categories
- covered Lesson Topics and Lesson Key Phrases
- repeated Lesson Key Phrase count
- validation that generated output stays within repetition tolerance
- the raw Review Candidate list from obvious Coverage Evidence and Learning Journal cues

The target Topic Category selection algorithm should be deterministic:

- if there is no prior Topic Category, select the first useful beginner-flow unvisited category, starting with `greetings_basics`
- if the current Topic Category streak is 1, continue the current Topic Category by default for Category Depth unless the current category is blocked by validation constraints, no viable fresh Lesson Topic remains after retry, or stronger item-level Review Candidate / handoff / Learning Journal evidence clearly requires another category
- if the current Topic Category streak is 2, prefer rotation to a different Topic Category, allowing a 3rd session only for an explicit reason such as strong weakness, an unfinished sub-area, or Learning Journal / handoff guidance
- if the current Topic Category streak is 3 or more, block the current Topic Category and rotate to a different category
- when choosing among candidate categories, prefer never-visited categories, then least-covered categories, then oldest-seen categories, using the fixed beginner-friendly order only as a tie-breaker
- do not use randomness for category selection in this fix
- pass `selectedCategory`, `selectionReason`, `blockedCategories`, and `preferredCategories` into the generation prompt

Model interpretation should be constrained to:

- choosing the exact Lesson Topic inside the app-selected target Topic Category
- deciding which Review Candidate, if any, is pedagogically useful now
- weaving a Review Candidate into a fresh context without making it accidental repetition
- choosing Lesson Key Phrases inside avoid/review constraints
- designing the exercises

Review Candidates are not persisted as a separate table, queue, or user-facing feature. They are request-local planning artifacts. The durable evidence remains completed session metadata.

Learning Journal handling should follow a narrow prompt contract:

- `/api/session/generate` should fetch the user's current Learning Journal and pass it into `generateSessionPlan()` when present
- the session-generation prompt should label it clearly as `LEARNING JOURNAL — ADVISORY TUTOR MEMORY`
- prompt instructions should say to use it for learner tendencies, persistent weak spots, semantic continuity, and Review Candidate interpretation
- prompt instructions should also say not to use it as exact proof that a Topic Category, Lesson Topic, or Lesson Key Phrase was or was not covered; Coverage Evidence remains authoritative for exact coverage and validation
- do not add a separate pre-generation model call to summarize or extract the journal
- the whole stored journal should be sent, subject only to a defensive character cap; the journal update flow should keep the stored journal compact enough that truncation is normally unnecessary
- if the Learning Journal is missing, empty, stale, or truncated by the defensive cap, generation should continue using Coverage Evidence rather than failing

Learning Journal update rules should make the journal useful as reusable tutor memory without turning it into the coverage ledger:

- keep the existing structured headings or an equivalent stable machine-readable shape
- keep the journal bounded; the current update prompt's under-500-word target is the right scale unless implementation shows prompt bloat
- preserve persistent weaknesses, mastered trajectory, and useful semantic notes over exhaustive phrase coverage
- avoid letting the journal's vocabulary bank become the authoritative phrase history; structured completed-session metadata and Coverage Evidence own that job
- include enough category/topic language for tutor continuity, but avoid implying exact Coverage Evidence when the source is only interpretation

Review Candidate derivation should be item-specific:

- a low-accuracy Learning Session is a signal to inspect the specific exercises and handoff, not a reason to mark every covered phrase as needing review
- a Lesson Key Phrase becomes a Review Candidate only when there is wrong or mixed result evidence tied to that phrase, or when handoff notes / Learning Journal context explicitly mention that phrase or a narrowly related Lesson Topic weakness
- a Lesson Topic becomes a Review Candidate only when errors or explicit tutor notes point to the topic itself, not merely because it appeared in a weak session
- correctly answered phrase-level exercises in a weak session should stay covered, not automatically reviewable
- model-facing Review Candidates should stay capped to a small list, normally 3–5, sorted by recency and strength of weakness evidence

Post-generation validation should compare generated Lesson Key Phrases against covered key phrases:

- zero repeated non-candidate key phrases is the target
- one repeated non-candidate key phrase is tolerated to avoid brittle retries for common connector phrases
- more than one repeated non-candidate key phrase should reject/retry the generation
- repeated Review Candidates are allowed only for their stated review reason and should normally appear as bridge/contrast material rather than the main Lesson Key Phrase again
- lesson category must match the app-selected target Topic Category, which must satisfy the allowed/preferred/blocked category rails including mandatory rotation after a 3-session streak
- lesson topic should not be an exact normalized covered-topic repeat unless the session intentionally uses it as review or contrast
- near-neighbour Lesson Topics inside the same Topic Category should be allowed when they create real new coverage; prompt guidance should ask for a fresh concrete situation, but validation should not fail on subjective semantic similarity
- on validation failure, retry once with compact validation feedback to the model
- if the retry still fails, return the normal user-facing generation error and do not create/store the bad session
- rejected generation attempts that return token usage should be recorded with `sessionId: null`; successful final generation usage should remain attached to the created session
- log sanitized validation failure details server-side, including failure reason codes, selected category, blocked/preferred category state, repeated phrase count, and attempt number; do not log full prompts, full learner journal, auth data, or raw model payloads

## Constraints

- Keep the work inside the Learning Session feature.
- Do not introduce dashboards, manual curriculum editors, spaced-repetition UI, or other new product surfaces.
- Preserve existing learner history where possible.
- Treat old sessions with missing structured coverage as lower-confidence evidence, not as proof that material was never covered.
- Do not add fuzzy text-mining or middle-layer rescue logic for unparseable old summaries in this fix. If old history is parseable, use it; if it is not parseable, leave it out of hard Coverage Evidence and validation.

## Validation target

A completed implementation should be validated with `npm run validate:ci` and with targeted tests or fixtures showing that repeated categories and repeated Lesson Key Phrases are avoided unless explicitly justified as review.

## Implementation progress

Updated: 2026-07-02

- [x] Task 1 — Store structured Lesson Key Phrase details on session completion and parse them from `SessionMeta`.
  - Added optional `SessionMeta.keyPhraseDetails` metadata with sanitized `japanese`, `romaji`, `english`, and `usage` fields.
  - `/learn` now sends structured `lesson.keyPhrases` during session completion while preserving the legacy `keyPhrases: string[]` payload.
  - `/api/session/complete` sanitizes structured details, caps stored items, bounds each detail field, derives legacy phrase strings from the best available structured text, and falls back to legacy request phrases or exercise-derived phrases when needed.
  - Added validator and route tests for structured detail parsing, invalid-shape filtering, stored item caps, field-length bounds, legacy phrase derivation, and fallback behavior.
  - Validation: `npm test -- src/lib/validators/session-meta.test.ts src/routes/api/session/complete.server.test.ts`; `npm run validate:ci`.
- [x] Task 2 — Add deterministic Coverage Evidence builder: full parseable AI history, normalized phrase/topic identities, category rotation selection, and review candidates.
  - Added `session-coverage-evidence` as a pure internal builder with full parseable completed-AI source parsing, normalized exact Lesson Topic and Lesson Key Phrase identities, covered category/topic/phrase recency and count evidence, app-side category selection rails, compact prompt snapshot caps, and transient Review Candidate derivation.
  - Extracted Topic Category constants into `topic-categories` so coverage, prompts, and later validation can share one deterministic category order without prompt-module cycles.
  - Phrase identity matching catches exact normalized variants such as inline `すみません (sumimasen)` and `Sumimasen!` while avoiding semantic-neighbour blocking such as `失礼します`; romaji/English phrase and Lesson Topic mentions use normalized token-sequence matching so substring-only matches like `go` inside `ongoing` do not create false Review Candidates.
  - Category streak evidence treats missing/unknown categories as a streak break instead of silently skipping them, so old malformed metadata cannot incorrectly force a rotation/block.
  - Review Candidates are conservative and item-specific: wrong/mixed exercise evidence, exact weakness/handoff mentions, exact Learning Journal mentions, with low accuracy only boosting existing item evidence. Exercise-result review evidence requires joined exercise content; rows without exercise content are ignored rather than guessed.
  - Prompt-facing Coverage Evidence is capped by item count and defensively truncates prompt fields to 160 characters; full app-side coverage remains available for later validation.
  - Validation: `npm test -- src/lib/server/session-coverage-evidence.test.ts src/lib/server/ai-session-prompts.test.ts`; `npm run check && npm run lint`; Task 2 quality re-review returned APPROVED.
- [x] Task 3 — Wire Coverage Evidence and Learning Journal into session generation prompt/input with selected category rails.
  - `/api/session/generate` now queries the full completed AI Learning Session history plus joined completed exercise results, parses completed-session metadata into Coverage Evidence sources, builds deterministic Coverage Evidence with the current `progressJournal`, and passes the compact prompt snapshot plus bounded Learning Journal into `generateSessionPlan()`.
  - Added completed-AI history DB helpers for full completed session reads and joined result/exercise rows so Review Candidate evidence can stay item-specific instead of guessing from result ids alone.
  - Session generation prompts now label Coverage Evidence as authoritative app-side rails, include selected target category/allowed/preferred/blocked category state, include covered topic/key-phrase avoid lists and Review Candidates, and label the Learning Journal as advisory tutor memory rather than exact coverage proof.
  - Added route and prompt tests for Coverage Evidence wiring, full-history source counts, selected-category rails, Learning Journal handoff, and joined exercise-result review evidence.
  - Validation: `npm test -- src/routes/api/session/generate.server.test.ts src/lib/server/ai-session-prompts.test.ts src/lib/server/session-coverage-evidence.test.ts`; `npm run validate:ci`.
- [x] Task 4 — Add post-generation curriculum validation/retry and record rejected attempt usage with `sessionId: null`.
  - Added a pure `session-curriculum-validation` guard that rejects category mismatches, blocked categories, exact covered Lesson Topic repeats without Review Candidate evidence, and more than one repeated non-review Lesson Key Phrase.
  - `/api/session/generate` now validates each generated plan before creating a session, records rejected model-call token usage with `sessionId: null`, retries once with compact curriculum feedback, logs sanitized failure details, and fails closed without creating/storing a bad session if both attempts violate rails.
  - Session-generation prompts now carry compact retry feedback into the next model attempt and expose it in the structured user payload for testable prompt wiring.
  - Added validator, prompt, and route tests for category rails, topic/phrase repetition tolerance, rejected-attempt usage accounting, successful retry, and closed failure after repeated validation rejection.
  - Validation: `npm test -- src/lib/server/ai-session-prompts.test.ts src/lib/server/session-curriculum-validation.test.ts src/routes/api/session/generate.server.test.ts`; `npm run validate:ci`.
- [x] Task 5 — Run full validation, update plan progress/handoff, and commit final docs/status.
  - Ran full CI validation after Task 4 implementation: `npm run validate:ci`.
  - Updated this plan with Task 4 implementation and validation status.
  - Code/docs commits: `43c71a8 feat: wire coverage evidence into session generation`; `8522c53 Validate generated session curriculum rails`.

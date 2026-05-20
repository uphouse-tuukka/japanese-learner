# Speaking Exercise Type Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Do not dispatch parallel agents against the same large files (`ai-session-prompts.ts`, `ai-session-normalizers.ts`, `types.ts`) without coordination.

**Goal:** Add private learn/practice microphone-based speaking exercises where learners answer by speaking Japanese, receive a transcript-backed grade, and raw audio is never stored.

**Architecture:** Add a new `speaking` discriminated exercise type, teach AI generation how to produce it for eligible private sessions, normalize/validate it server-side, render it through `SessionRenderer`, and evaluate submitted microphone audio through a new authenticated multipart endpoint that transcribes then grades the transcript. Public portfolio challenge must explicitly exclude speaking exercises.

**Tech stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Turso/libsql JSON exercise storage, OpenAI Responses API, OpenAI audio transcription API.

Created: 2026-05-19 16:30:38

Updated: 2026-05-20 after implementation validation

Status: Ready for review / browser acceptance

## Implementation progress

- 2026-05-19 Task 0 complete: pulled latest `origin/master`, confirmed clean checkout at `b6954ed`, and reviewed required project/docs/decision files before editing.
- 2026-05-19 Task 1 complete: added shared `speaking` exercise type and union shape in `src/lib/types.ts`. `npm run check` now intentionally exposes the next type surfaces to update (`ai-session-prompts.ts`, `ai-summary-prompts.ts`, `debug-exercises.ts`, `SessionRenderer.svelte`).
- 2026-05-19 Task 2 complete: added speaking debug fixtures, allowed `debugExerciseType: 'speaking'` in dev practice generation, and adjusted summary expected-answer extraction for speaking results. `npm test -- src/routes/api/practice/generate.server.test.ts` passes; `npm run check` is down to planned Task 3/8 surfaces (`ai-session-prompts.ts`, `SessionRenderer.svelte`).
- 2026-05-19 Task 3 complete: private prompts now allow speaking for `elementary` and above with response-kind rules, public challenge prompt uses an explicit no-microphone allowed-type boundary, and prompt wording distinguishes typed Japanese-writing restrictions from microphone speaking. `npm test -- src/lib/server/ai-session-prompts.test.ts` passes; `npm run check` is down to the planned renderer branch.
- 2026-05-19 Task 4 complete: normalizers now accept speaking exercises, clamp recording seconds, default accepted answers, enforce level/response-kind restrictions, and public challenge skips/fails safely on speaking output. `npm test -- src/lib/server/ai-session-normalizers.test.ts src/lib/server/ai.public-challenge.test.ts` passes; `npm run check` is still blocked only by the planned renderer branch.
- 2026-05-19 Task 5 complete: added server-side speaking checker helper with 5 MB audio validation, supported MIME/extension checks, OpenAI Japanese transcription, semantic grading, token usage accounting when token usage is available, and sanitized logging. `npm test -- src/lib/server/speaking-checker.test.ts` passes; `npm run check` remains blocked only by the planned renderer branch.
- 2026-05-19 Task 6 complete: added authenticated multipart `/api/speaking/check` route with selected-user cookie requirement, budget gate, bounded metadata parsing, safe client/server errors, and route tests. `npm test -- src/routes/api/speaking/check.server.test.ts` passes; `npm run check` remains blocked only by the planned renderer branch.
- 2026-05-19 Task 7 complete: added `SpeakingExercise.svelte` with explicit click-to-record MediaRecorder flow, MIME negotiation, auto-stop, track cleanup, `/api/speaking/check` multipart submission, transcript/result display, retry/error states, and continue-without-credit fallback. Fixed the Svelte state diagnostics by consistently using `recordingState` and `$state<RecordingState>()`. `npm run check` now reports only the planned `SessionRenderer.svelte` missing `speaking` branch.
- 2026-05-19 Task 8 complete: wired `SpeakingExercise.svelte` into `SessionRenderer.svelte`, kept the existing keyed reset behavior, and inspected learn, practice, and portfolio challenge route surfaces for renderer pass-through assumptions. Server-side public challenge guards remain responsible for excluding speaking from portfolio. `npm run check` passes.
- 2026-05-20 Task 9 complete: updated `README.md` and `documents/plans/ai-session-guidelines.md` with the speaking route, privacy boundary, level rules, response kinds, and structured romaji pairing.
- 2026-05-20 Task 10 CI validation complete: `npm run validate:ci` passes locally. Manual browser microphone acceptance remains the next verification step because it needs an interactive browser/microphone environment.

## Current checkout evidence

Review was performed against the current checkout at:

- Repo: `/Users/tuukka.ylostalo/Projects/japanese-learner`
- Branch: `master...origin/master`
- Head: `30689ca docs: add speaking exercise implementation plan`
- Working tree: clean before this plan update
- Installed OpenAI SDK: `openai@^6.32.0` in `package.json`

Relevant current-state facts:

- `src/lib/types.ts` has six exercise types: `multiple_choice`, `translation`, `fill_blank`, `reorder`, `reading`, `listening`.
- `src/lib/components/SessionRenderer.svelte` renders those six components and has no `speaking` branch.
- `src/lib/server/ai-session-prompts.ts` uses shared `LEVEL_RULES`, `levelInstructions()`, and `exerciseFieldRequirements()` for both private sessions and public challenge prompts.
- `src/lib/server/ai-public-challenge.ts` currently builds and validates public challenge exercises using beginner rules, so public challenge needs an explicit allowed-type guard before or alongside any speaking support.
- `src/lib/server/debug-exercises.ts` uses `Record<ExerciseType, ExerciseTemplate[]>`; adding `speaking` to `ExerciseType` will break TypeScript unless a speaking fixture is added or the record becomes partial.
- `src/routes/api/practice/generate/+server.ts` has a hardcoded debug exercise type allowlist containing the current six types.
- Exercise persistence stores exercise JSON in `exercises.content_json`, so no DB schema change is needed for a new exercise type.
- Completion persistence stores only `answer_text` and `is_correct`; for speaking, `answer_text` will be the transcript.

## Resolved implementation decisions

These are binding for the first implementation pass.

1. **Public challenge exclusion**
   - Public portfolio challenge must not generate, normalize, store, or render `speaking` exercises.
   - Add an explicit public challenge allowed-type boundary instead of relying on beginner level rules staying unchanged.
   - If the model emits `speaking` in public challenge output anyway, skip/reject it before validation and add regression tests.

2. **Private-session MVP scope**
   - `speaking` is for authenticated/private learn and practice sessions only.
   - Enable it for `elementary` and above in private AI generation.
   - Keep `absolute_beginner` and `beginner` excluded for MVP to avoid early learner frustration and to keep public beginner demo low-friction.
   - Practice may reuse stored speaking exercises once `SessionRenderer` supports them.

3. **Speaking prompt styles by level**
   - `elementary`: allow `situational_response` only, using short phrases taught in the lesson.
   - `pre_intermediate` and above: allow both `situational_response` and `translation_en_to_ja`.
   - Enforce this in `validateExerciseSet()` or a helper it calls; prompt text alone is not enough.

4. **Japanese writing preference does not block voice input**
   - `japaneseWritingEnabled` applies to typed/writing input only.
   - Speaking exercises may expect spoken Japanese even when Japanese writing input is disabled.
   - Update prompt wording so it does not say all learner input must be romaji/English when speaking is enabled.

5. **Romaji rule for structured speaking fields**
   - User-visible free-text Japanese must keep romaji support.
   - Structured fields may separate script and romaji:
     - `expectedAnswer`: Japanese script only
     - `expectedRomaji`: romanization only
   - Prompt rules must explicitly allow this pair so they do not contradict the schema.

6. **Audio and transcript retention**
   - Raw audio is transient: validate, send to OpenAI transcription, then discard. Do not store raw audio.
   - Transcript is the learner's answer and is stored in `user_exercise_results.answer_text` when the session completes.
   - Do not store model feedback/confidence in the first pass unless a later schema change is approved.

7. **Transcription API choice**
   - Use the installed SDK method `client.audio.transcriptions.create(...)`.
   - Use model `gpt-4o-mini-transcribe` for MVP unless implementation testing shows a compile/runtime issue.
   - Send `language: 'ja'`.
   - Supported upload formats in installed SDK types include `flac`, `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `ogg`, `wav`, and `webm`.

8. **Endpoint shape**
   - Create one combined route: `POST /api/speaking/check`.
   - It accepts `multipart/form-data` with one audio file plus bounded exercise metadata.
   - It returns `{ ok, transcript, correct, confidence, feedback? }`.
   - It requires `selected_user` cookie and uses that user id for budget and usage accounting. Do not expose this endpoint to public challenge.

9. **Unsupported browser behavior**
   - Do not auto-record on load.
   - If microphone APIs are unavailable or permission is denied, show a recoverable error and a “Continue without credit” path so the user is not trapped.
   - A typed fallback is deferred unless the component remains small; do not let fallback scope delay the microphone MVP.

## Data model

Modify `src/lib/types.ts`.

Add `speaking` to `ExerciseType` and add:

```ts
export interface SpeakingExercise extends BaseExercise {
  type: 'speaking';
  prompt: string;
  responseKind: 'situational_response' | 'translation_en_to_ja';
  expectedAnswer: string;
  expectedRomaji: string;
  acceptedAnswers: string[];
  rubric: string;
  maxRecordingSeconds?: number;
}
```

Then add `SpeakingExercise` to the `Exercise` union.

Notes:

- `prompt` is learner-visible and should be English-only unless any Japanese appears with romaji.
- `expectedAnswer` is Japanese script only.
- `expectedRomaji` is required for beginner accessibility and post-answer display.
- `acceptedAnswers` should contain natural Japanese-script alternatives and may include romaji alternatives only to support future typed fallback.
- `rubric` describes semantic acceptance criteria, especially for situational prompts.
- `maxRecordingSeconds` defaults to 12 seconds and is clamped by normalizer/server to 5-20 seconds.
- `ExerciseAnswerPayload.answerText` remains the transcript. No result schema change in MVP.

## Implementation tasks

### Task 0: Preflight and current-state check

**Objective:** Ensure the implementer starts from the same safe baseline.

**Files:** none.

**Steps:**

1. Run:

   ```bash
   git status --short --branch --untracked-files=all
   git log -1 --oneline
   ```

2. Confirm the working tree is clean or record existing user changes before editing.
3. Read:
   - `AGENTS.md`
   - `README.md`
   - `documents/CONTRIBUTING.md`
   - `documents/INDEX.md`
   - this plan
   - `documents/decisions/002-inline-audio-approach.md`
   - `documents/decisions/003-selected-user-api-boundary.md`

### Task 1: Add shared speaking types

**Objective:** Add `speaking` as a first-class exercise type without changing persistence schema.

**Files:**

- Modify: `src/lib/types.ts`

**Steps:**

1. Add `'speaking'` to `ExerciseType`.
2. Add `SpeakingExercise` with the schema above.
3. Add `SpeakingExercise` to the `Exercise` union.
4. Run:

   ```bash
   npm run check
   ```

   Expected at this point: failures are acceptable if they identify exhaustive type surfaces that still need updating, especially `debug-exercises.ts`.

### Task 2: Update debug/practice type surfaces

**Objective:** Prevent TypeScript fallout from the expanded exercise union and make local manual testing possible.

**Files:**

- Modify: `src/lib/server/debug-exercises.ts`
- Modify: `src/routes/api/practice/generate/+server.ts`
- Modify: `src/routes/api/practice/generate.server.test.ts`

**Steps:**

1. Prefer adding at least two `speaking` templates to `DEBUG_EXERCISE_TEMPLATES` rather than weakening the type to `Partial<Record<...>>`.
2. Include one `situational_response` fixture and one `translation_en_to_ja` fixture.
3. Add `'speaking'` to the dev `EXERCISE_TYPES` allowlist in `src/routes/api/practice/generate/+server.ts`.
4. Add/adjust route tests so `debugExerciseType: 'speaking'` returns speaking fixtures in dev mode.
5. Run:

   ```bash
   npm test -- src/routes/api/practice/generate.server.test.ts
   ```

### Task 3: Add private prompt support and explicit public challenge boundaries

**Objective:** Teach private AI session generation about speaking while guaranteeing public challenge cannot use it.

**Files:**

- Modify: `src/lib/server/ai-session-prompts.ts`
- Modify: `src/lib/server/ai-session-prompts.test.ts`

**Private prompt changes:**

1. Add `speaking` to `EXERCISE_FIELD_REQUIREMENTS`:
   - required fields: `prompt`, `responseKind`, `expectedAnswer`, `expectedRomaji`, `acceptedAnswers`, `rubric`, optional `maxRecordingSeconds`
   - prompt must tell learner to speak Japanese
   - expected answer must be Japanese script paired with `expectedRomaji`
   - accepted answers should contain natural alternatives when realistic
   - rubric must describe semantic correctness without requiring exact wording

2. Update private `LEVEL_RULES`:
   - `absolute_beginner`: unchanged, no speaking
   - `beginner`: unchanged, no speaking
   - `elementary`: add `speaking`
   - `pre_intermediate` and above: add `speaking`

3. Update `levelInstructions()`:
   - elementary: explicitly allows short speaking situational responses only
   - pre_intermediate and above: allows speaking situational responses and spoken English-to-Japanese translation
   - absolute_beginner/beginner: explicitly no speaking

4. Fix prompt contradictions:
   - Replace blanket “every Japanese string anywhere” wording with structured-field-aware wording.
   - Keep learner-visible romaji support.
   - State that `japaneseWritingEnabled` disables typed Japanese-writing prompts, not microphone speaking prompts.

5. Update the private required output example only if it does not make tests brittle. If adding an example, use an eligible level context or clearly label it as conditional.

**Public challenge changes:**

1. Add an explicit public challenge type boundary in `ai-session-prompts.ts`, for example:

   ```ts
   const PUBLIC_CHALLENGE_ALLOWED_TYPES: ExerciseType[] = [
     'multiple_choice',
     'translation',
     'listening',
   ];
   ```

2. Do not call `exerciseFieldRequirements('beginner')` unfiltered in `buildPublicChallengePrompt()` once beginner/private rules may diverge.
3. Build public field requirements from the explicit public allowed list.
4. Add prompt text: “Public challenge must not include speaking exercises or require microphone access.”

**Tests:**

Add/update tests proving:

- elementary private prompts mention speaking.
- beginner and absolute_beginner private prompts exclude speaking.
- public challenge prompt excludes speaking even if private rules later change.
- `japaneseWritingEnabled: false` no longer contradicts speaking for eligible levels.

Run:

```bash
npm test -- src/lib/server/ai-session-prompts.test.ts
```

### Task 4: Normalize and validate speaking exercises

**Objective:** Accept valid speaking AI output and reject level-inappropriate speaking output deterministically.

**Files:**

- Modify: `src/lib/server/ai-session-normalizers.ts`
- Modify: `src/lib/server/ai-session-normalizers.test.ts`
- Modify: `src/lib/server/ai-public-challenge.ts`
- Modify: `src/lib/server/ai.public-challenge.test.ts`

**Normalizer changes:**

1. Update `isExerciseType()` to accept `speaking`.
2. Add `speaking: 'Speaking Practice'` to `EXERCISE_TYPE_TITLES`.
3. Add a `normalizeExercise()` branch for `speaking`:
   - require `prompt`, `expectedAnswer`, `expectedRomaji`, and `rubric`
   - normalize `acceptedAnswers` from `acceptedAnswers`, `accepted_answers`, or `alternatives`
   - fallback accepted answers to `[expectedAnswer, expectedRomaji]`
   - normalize `responseKind`, defaulting to `situational_response` unless exactly `translation_en_to_ja`
   - clamp `maxRecordingSeconds` to 5-20, default 12

**Validation changes:**

1. Extend `validateExerciseSet()` or add a helper it calls:
   - reject `speaking` for `absolute_beginner` and `beginner`
   - for `elementary`, reject `translation_en_to_ja`
   - for `pre_intermediate` and above, accept both response kinds
2. Keep existing difficulty and translation direction checks.

**Public challenge guard:**

1. In `generatePublicChallengePlan()`, explicitly skip/reject `speaking` raw exercises before they can pass validation.
2. Validate public exercises against a public allowed-type set, not only `validateExerciseSet(..., 'beginner')`.
3. Public challenge must continue rendering through the existing low-friction components only.

**Tests:**

Add tests covering:

- valid `speaking` normalization.
- default/clamped `maxRecordingSeconds`.
- fallback `acceptedAnswers`.
- `speaking` rejected for beginner/absolute_beginner.
- `translation_en_to_ja` speaking rejected for elementary.
- public challenge skips or rejects `speaking` output and still succeeds when other valid exercises remain.
- public challenge fails safely if all returned exercises are speaking/invalid.

Run:

```bash
npm test -- src/lib/server/ai-session-normalizers.test.ts
npm test -- src/lib/server/ai.public-challenge.test.ts
```

### Task 5: Add server-side speaking checker helper

**Objective:** Transcribe short audio and grade the transcript with safe cost, privacy, and validation boundaries.

**Files:**

- Create: `src/lib/server/speaking-checker.ts`
- Modify: `src/lib/server/answer-checker.ts` if sharing grading logic is cleaner
- Add tests near existing server helper tests, for example `src/lib/server/speaking-checker.test.ts`

**Helper design:**

Export a helper shaped roughly like:

```ts
export type SpeakingCheckInput = {
  userId: string;
  audio: File;
  prompt: string;
  responseKind: 'situational_response' | 'translation_en_to_ja';
  expectedAnswer: string;
  expectedRomaji: string;
  acceptedAnswers: string[];
  rubric: string;
};

export type SpeakingCheckResult = {
  transcript: string;
  correct: boolean;
  confidence: 'high' | 'medium' | 'low';
  feedback?: string;
};
```

Implementation requirements:

1. Use `getOpenAiClient()` from `src/lib/server/openai-client.ts`; do not create another uncached local OpenAI client.
2. Validate file size before OpenAI calls. MVP max: 5 MB.
3. Validate MIME/extension against OpenAI-supported audio formats. Accept browser-practical types such as:
   - `audio/webm`
   - `audio/mp4`
   - `audio/mpeg`
   - `audio/mp3`
   - `audio/wav`
   - `audio/ogg`
   - `audio/m4a`
   - `audio/x-m4a`
4. Transcribe with:

   ```ts
   await client.audio.transcriptions.create({
     file: audio,
     model: 'gpt-4o-mini-transcribe',
     language: 'ja',
     response_format: 'json',
   });
   ```

   Adjust only if `npm run check` proves the installed SDK type requires a different shape.

5. Trim transcript and treat an empty transcript as a recoverable client error.
6. Grade transcript semantically, not pronunciation. Include `prompt`, `responseKind`, `expectedAnswer`, `expectedRomaji`, `acceptedAnswers`, and `rubric` in the grading prompt.
7. Return short safe feedback suitable for display, but do not persist it in MVP.
8. Usage accounting:
   - grading call: record token usage as `answer-checker.ts` already does.
   - transcription call: if SDK usage is token-based, record token usage; if duration-based, log sanitized duration metadata only and record no fake token counts.
9. Logging:
   - Do not log raw audio, full transcript, expected answer, accepted answers, or rubric.
   - Log only route/helper name, user id, MIME type, byte size, model, status, and token/duration counts.

**Tests:**

Mock the OpenAI client and assert:

- valid audio triggers transcription then grading.
- empty transcript returns/throws a recoverable error before grading.
- oversized audio is rejected before OpenAI.
- unsupported MIME is rejected before OpenAI.
- token-based transcription usage is recorded.
- duration-based usage does not invent token counts.
- grading prompt includes rubric context but tests should not snapshot full user content.

### Task 6: Add `/api/speaking/check` route

**Objective:** Expose authenticated multipart speaking evaluation to the private app only.

**Files:**

- Create: `src/routes/api/speaking/check/+server.ts`
- Create: route test if current patterns support it, for example `src/routes/api/speaking/check.server.test.ts`

**Route requirements:**

1. Require `selected_user` cookie. If missing, return `401 { ok: false, error: 'Not authenticated.' }`.
2. Use the cookie user id for budget checks and usage. Do not require public clients to pass `userId`; this endpoint is not for public challenge.
3. Require `multipart/form-data`; reject other content types with 400 or 415.
4. Call `checkBudget(userId)` before transcription/grading. If exhausted, return 429 with a safe error.
5. Parse `request.formData()`.
6. Require audio field name `audio` containing a `File`.
7. Accept bounded metadata fields:
   - `prompt`
   - `responseKind`
   - `expectedAnswer`
   - `expectedRomaji`
   - `acceptedAnswers` as JSON array or newline-separated string
   - `rubric`
8. Enforce metadata length limits before OpenAI calls. Suggested caps:
   - prompt: 500 chars
   - expectedAnswer: 200 chars
   - expectedRomaji: 200 chars
   - acceptedAnswers: max 10 entries, 200 chars each
   - rubric: 1000 chars
9. Call the speaking checker helper.
10. Return:

    ```json
    {
      "ok": true,
      "transcript": "...",
      "correct": true,
      "confidence": "high",
      "feedback": "..."
    }
    ```

11. Return safe errors only. Do not leak OpenAI internals or raw model responses.

**Tests:**

Add tests covering:

- missing cookie returns 401 before parsing/calling OpenAI.
- non-multipart request is rejected.
- missing audio is rejected.
- budget exhausted returns 429 before OpenAI.
- oversized/invalid metadata is rejected.
- successful helper result is returned.
- helper failure returns safe 500.

### Task 7: Add speaking exercise UI

**Objective:** Let learners record, submit, review transcript/result, and continue without storing raw audio client-side longer than needed.

**Files:**

- Create: `src/lib/components/exercises/SpeakingExercise.svelte`
- Optionally create: `src/lib/utils/audio-recording.ts` if recording logic makes the component too large
- Add component/helper tests if practical

**Component requirements:**

1. Use Svelte 5 runes syntax: `$props()`, `$state()`, `$derived()` as appropriate.
2. Accept `{ exercise, onAnswer }` props, where `exercise` is `SpeakingExercise`.
3. States:
   - `idle`
   - `requesting_permission`
   - `recording`
   - `processing`
   - `answered`
   - `error`
   - `unsupported`
4. Use `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder` only after an explicit button click.
5. Choose MIME type with `MediaRecorder.isTypeSupported()` in priority order, for example:
   - `audio/webm;codecs=opus`
   - `audio/webm`
   - `audio/mp4`
6. Auto-stop at `exercise.maxRecordingSeconds ?? 12`, clamped client-side to 5-20.
7. Allow manual stop.
8. Release media tracks on stop, cancel, error, and component teardown.
9. Submit `FormData` to `/api/speaking/check` with field name `audio` and the bounded metadata listed above.
10. Show:
    - prompt
    - recording timer
    - clear permission/error states
    - transcript after processing
    - correct/not-quite feedback
    - expected Japanese + romaji only after answer
    - retry option before continuing if recording failed or transcript is empty
    - “Continue without credit” for unsupported/permission-denied cases
11. Accessibility:
    - buttons are keyboard-operable
    - status changes use `aria-live`
    - no auto-recording
    - visible recording state; do not rely on color only
12. Styling:
    - use project design tokens from `src/app.css`
    - follow existing exercise component layout patterns

**Answer behavior:**

- On successful check, call `onAnswer` only when the learner clicks Continue.
- Payload:

  ```ts
  {
    exerciseId: exercise.id,
    answerText: transcript,
    isCorrect: result.correct,
  }
  ```

- For “Continue without credit”, use a clear non-user-transcript answer such as `[speaking unavailable]` and `isCorrect: false`.

### Task 8: Wire renderer and route surfaces

**Objective:** Make private learn/practice/portfolio route surfaces behave intentionally.

**Files:**

- Modify: `src/lib/components/SessionRenderer.svelte`
- Inspect: `src/routes/learn/+page.svelte`
- Inspect: `src/routes/practice/+page.svelte`
- Inspect: `src/routes/portfolio/challenge/+page.svelte`

**Steps:**

1. Import `SpeakingExercise.svelte`.
2. Add `{:else if exercise.type === 'speaking'}` branch.
3. Keep the existing `{#key exercise.id}` reset behavior.
4. Confirm learn and practice pages pass through `SessionRenderer` without exercise-type-specific assumptions.
5. Portfolio challenge should not receive speaking exercises because of server-side guards. Do not add public microphone UX in MVP.

### Task 9: Update completion/privacy docs and README

**Objective:** Keep project docs aligned with the new route/type/component and privacy boundary.

**Files:**

- Modify: `documents/plans/ai-session-guidelines.md`
- Modify: `README.md`
- Inspect: `documents/INDEX.md`; update only if it indexes this plan or active status explicitly

**Docs changes:**

1. `documents/plans/ai-session-guidelines.md`:
   - add speaking standards
   - document level rules
   - document response kinds
   - document romaji/expectedRomaji pairing
   - document public challenge exclusion
   - document privacy: raw audio transient, transcript stored as answer text

2. `README.md`:
   - add `/api/speaking/check` to API route list
   - update architecture summary from “6 exercise components” to the new count or avoid hardcoded count
   - mention OpenAI API key also powers speaking transcription/evaluation

3. Do not add secrets, raw transcripts, or example personal user audio content to docs.

### Task 10: Validation and manual acceptance

**Objective:** Prove the implementation compiles, tests, and behaves in a browser.

**Targeted tests to run while implementing:**

```bash
npm test -- src/lib/server/ai-session-prompts.test.ts
npm test -- src/lib/server/ai-session-normalizers.test.ts
npm test -- src/lib/server/ai.public-challenge.test.ts
npm test -- src/routes/api/practice/generate.server.test.ts
npm test -- src/lib/server/speaking-checker.test.ts
npm test -- src/routes/api/speaking/check.server.test.ts
```

Adjust file names if the route/helper tests are placed elsewhere.

**Full validation before handoff:**

```bash
npm run validate:ci
```

**Manual browser validation:**

1. Start dev server:

   ```bash
   npm run dev
   ```

2. Generate a private session or use dev practice debug generation with `debugExerciseType: 'speaking'`.
3. Verify microphone permission flow.
4. Verify recording starts/stops and browser mic indicator turns off after stop/cancel/navigation.
5. Verify a short Japanese answer returns transcript and graded result.
6. Verify empty/noisy audio returns a recoverable error and does not complete the exercise.
7. Verify unsupported/denied microphone path lets the learner continue without credit.
8. Verify practice mode can render a stored speaking exercise.
9. Verify public portfolio challenge never asks for microphone and never renders `speaking`.
10. Verify completion stores transcript as `answer_text` and never stores raw audio.

## Files likely to change

Core:

- `src/lib/types.ts`
- `src/lib/server/ai-session-prompts.ts`
- `src/lib/server/ai-session-normalizers.ts`
- `src/lib/server/ai-public-challenge.ts`
- `src/lib/server/debug-exercises.ts`
- `src/routes/api/practice/generate/+server.ts`
- `src/lib/components/SessionRenderer.svelte`
- `src/lib/components/exercises/SpeakingExercise.svelte` (new)
- `src/lib/server/speaking-checker.ts` (new)
- `src/routes/api/speaking/check/+server.ts` (new)

Tests:

- `src/lib/server/ai-session-prompts.test.ts`
- `src/lib/server/ai-session-normalizers.test.ts`
- `src/lib/server/ai.public-challenge.test.ts`
- `src/routes/api/practice/generate.server.test.ts`
- `src/lib/server/speaking-checker.test.ts` (new, suggested)
- `src/routes/api/speaking/check.server.test.ts` (new, suggested)

Docs:

- `documents/plans/ai-session-guidelines.md`
- `README.md`
- `documents/INDEX.md` only if needed

## Risks and mitigations

- **Public challenge leakage:** explicit public allowed-type guard and regression tests.
- **Prompt/schema contradiction:** structured-field romaji rule and speaking exception to `japaneseWritingEnabled` wording.
- **TypeScript union fallout:** update debug fixtures/allowlists and run `npm run check` early.
- **Audio upload abuse/cost:** selected-user cookie, budget check before OpenAI, max size, MIME validation, metadata length caps.
- **Privacy:** raw audio transient, sanitized logs only, transcript stored as answer text and documented.
- **Transcription errors:** show transcript before continuing; grade transcript semantically but do not pretend it measures pronunciation perfectly.
- **Browser support variance:** MIME negotiation, unsupported state, permission-denied recovery, track cleanup.
- **Usage accounting ambiguity:** record token usage when usage is token-based; never invent token counts from duration.

## Non-goals for MVP

- Public/portfolio speaking exercises.
- Pronunciation scoring from audio phonetics.
- Storing raw audio or replayable recordings.
- New DB schema for confidence/feedback storage.
- User/profile preference such as `speakingExercisesEnabled`.
- Realtime streaming transcription.
- Typed fallback as a full alternative exercise mode.
- Mobile-browser polishing beyond basic MediaRecorder compatibility.

## Handoff prompt for implementation agent

Implement `documents/plans/2026-05-19-speaking-exercise-type.md` from the current checkout. Follow AGENTS.md and documents/CONTRIBUTING.md. Use TDD where practical. Start with types/debug/prompt/normalizer/public guard before UI. Public portfolio challenge must explicitly exclude speaking. Raw audio must never be stored; transcript is stored as answerText. Run targeted tests after each task and `npm run validate:ci` before final handoff. Keep docs in sync and report exact validation results.

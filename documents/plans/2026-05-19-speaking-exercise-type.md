# Plan: Add microphone-based speaking exercises

Created: 2026-05-19 16:30:38

## Goal

Add a new exercise type to Japanese Learner where the learner answers by speaking Japanese into their device microphone. The exercise should support at least two prompt styles:

1. Situational response: “What would be a proper response in this situation?”
2. Spoken translation: “Translate this English phrase into Japanese.”

The first implementation should fit the existing lesson → quiz flow, use the existing OpenAI-backed answer checking pattern, preserve beginner accessibility with romaji support, and avoid storing raw audio.

## Current context / assumptions

- Repo: `/home/uphouse-tuukka/Projects/japanese-learner`
- Working tree was clean at planning time: `## master...origin/master`
- Stack: SvelteKit 2, Svelte 5 runes, TypeScript, Turso/libsql, OpenAI.
- Existing exercise architecture:
  - `src/lib/types.ts` defines `ExerciseType` and discriminated exercise interfaces.
  - `src/lib/components/SessionRenderer.svelte` routes exercise types to Svelte components.
  - `src/lib/components/exercises/*` components call a shared `onAnswer(payload)` callback.
  - AI-generated exercises are normalized in `src/lib/server/ai-session-normalizers.ts` and prompted in `src/lib/server/ai-session-prompts.ts`.
  - Exercise content is stored as JSON; adding a type should not require a DB schema change.
  - Translation already uses `/api/check-answer` and `src/lib/server/answer-checker.ts` for semantic AI grading after exact matching fails.
- Existing audio/TTS context:
  - App already uses browser/server TTS through `src/lib/utils/tts.ts` and `src/lib/utils/audio.ts`.
  - `OPENAI_API_KEY` is already required for AI-backed features and server TTS.
- Documentation constraints:
  - For implementation, read `AGENTS.md`, `README.md`, `documents/CONTRIBUTING.md`, `documents/INDEX.md`, and relevant decisions/plans first.
  - Significant AI prompt/session behavior changes should update `documents/plans/ai-session-guidelines.md` or add a plan under `documents/plans/` if the implementation is substantial.

## Proposed approach

Implement a new `speaking` exercise type with a dedicated UI component and server-side speech evaluation:

- Use `MediaRecorder` in the browser to capture a short audio clip from the learner’s microphone.
- Submit the audio to a server endpoint as `multipart/form-data`.
- Server transcribes the clip using OpenAI audio transcription.
- Server grades the transcription against the expected Japanese answer, accepted variants, and situational rubric using the existing answer-checking style.
- Frontend displays:
  - recording controls,
  - permission/error states,
  - transcribed answer,
  - correct/not-quite feedback,
  - expected answer with romaji,
  - continue button calling `onAnswer` with the transcript as `answerText`.

Prefer a combined server endpoint for MVP:

- `POST /api/speaking/check`
  - input: audio blob, exercise metadata needed for grading.
  - output: `{ ok, transcript, correct, confidence, feedback? }`.

This keeps the frontend simple and avoids two round trips (`transcribe` then `check-answer`). If later we need transcript reuse, split transcription into a separate helper function, not necessarily a separate public route.

## Data model

Add `speaking` to `ExerciseType` and add a new interface in `src/lib/types.ts`:

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

Notes:

- `prompt` is learner-visible and should be English-only unless it includes Japanese with romaji.
- `expectedAnswer` should be Japanese script, ideally without inline romaji.
- `expectedRomaji` is required for beginner accessibility.
- `acceptedAnswers` should include Japanese alternatives and optionally romaji alternatives if useful.
- `rubric` lets situational prompts accept natural variants, e.g. “Accept polite phrases that call staff attention, such as すみません, before asking a question.”
- `maxRecordingSeconds` defaults in UI/server, probably 10–15 seconds.

## Level rules

Update `LEVEL_RULES` in `src/lib/server/ai-session-prompts.ts` carefully:

- Do not enable speaking for `absolute_beginner` in the first pass.
- Enable `speaking` for `beginner` and above only for short situational responses already taught in the lesson.
- Allow `translation_en_to_ja` speaking preferably from `elementary` upward, unless the prompt is constrained to one short phrase.
- Speaking should not be gated by `japaneseWritingEnabled`; this is voice input, not typing.
- Keep every Japanese learner-visible string with romaji support.

## Step-by-step plan

### 1. Add shared types

Files:

- `src/lib/types.ts`

Tasks:

- Add `'speaking'` to `ExerciseType`.
- Add `SpeakingExercise` interface.
- Add it to the `Exercise` union.
- Keep `ExerciseAnswerPayload.answerText` as the transcript; no schema change needed.

### 2. Extend AI prompting

Files:

- `src/lib/server/ai-session-prompts.ts`
- `documents/plans/ai-session-guidelines.md` or a new implementation doc under `documents/plans/`

Tasks:

- Add `speaking` to `EXERCISE_FIELD_REQUIREMENTS`.
- Extend `LEVEL_RULES.allowedTypes` for levels selected above.
- Update `levelInstructions()` text so the model knows when speaking is allowed.
- Add prompt rules:
  - speaking exercises must test phrases taught in the lesson,
  - prompt must clearly say the learner should speak Japanese,
  - expected answer must be Japanese script plus paired romaji field,
  - accepted answers should include at least 3 natural variants for situational response where realistic,
  - rubric must describe what counts as correct without requiring exact wording.
- Update the required output example with one `speaking` example for an eligible level, if test impact is manageable.

### 3. Extend AI normalization and validation

Files:

- `src/lib/server/ai-session-normalizers.ts`
- `src/lib/server/ai-session-normalizers.test.ts`
- `src/lib/server/ai-session-prompts.test.ts`

Tasks:

- Update `isExerciseType()` to accept `speaking`.
- Add title in `EXERCISE_TYPE_TITLES`.
- Add `normalizeExercise()` branch for `speaking`:
  - require `prompt`, `expectedAnswer`, `expectedRomaji`, `rubric`,
  - normalize `acceptedAnswers` with fallback `[expectedAnswer, expectedRomaji]`,
  - normalize `responseKind`, defaulting to `situational_response` unless explicitly `translation_en_to_ja`,
  - clamp/default `maxRecordingSeconds` to a safe range, e.g. 5–20 seconds.
- Keep existing `validateExerciseSet()` level enforcement through `LEVEL_RULES`.
- Add tests covering:
  - valid speaking normalization,
  - unsupported speaking type for `absolute_beginner`,
  - prompt includes speaking field requirements for eligible levels,
  - prompt excludes speaking for `absolute_beginner`.

### 4. Add server-side transcription and grading

Preferred files:

- `src/lib/server/speaking-checker.ts` (new)
- `src/routes/api/speaking/check/+server.ts` (new)
- `src/lib/server/answer-checker.ts` (small extension if reusing grading)
- `src/lib/server/api.test.ts` or a new route/helper test if route testing pattern exists

Tasks:

- Create a server-only helper that:
  - receives an audio `File`/`Blob`,
  - validates size and MIME type,
  - sends it to OpenAI transcription with Japanese language hint (`language: 'ja'` if supported by selected API/model),
  - returns trimmed transcript.
- Create a grading helper or extend `checkAnswerWithAI()` to accept optional context:
  - `prompt`,
  - `rubric`,
  - `responseKind`,
  - `expectedRomaji`.
- The grading prompt should evaluate semantic appropriateness, not exact pronunciation. It should treat transcription errors cautiously but not blindly mark nonsense correct.
- Record token usage for the grading call as existing answer checker does. If transcription usage is available from the SDK response, record it too; if not, log only sanitized metadata.
- API route requirements:
  - require `selected_user` cookie, matching existing `/api/check-answer` behavior,
  - accept only `multipart/form-data`,
  - enforce max audio size, e.g. 3–5 MB,
  - enforce max metadata lengths to avoid prompt abuse,
  - never log raw audio or full spoken content,
  - return safe errors: permission/client errors should not leak internals.

Open question to verify during implementation: exact OpenAI SDK method/model for transcription in current `openai` package version (`^6.32.0`). Do not guess; inspect SDK docs/types or existing package API before coding. Annoying, yes, but less annoying than shipping a route that compiles beautifully and runs never.

### 5. Add microphone UI component

Files:

- `src/lib/components/exercises/SpeakingExercise.svelte` (new)
- `src/lib/components/SessionRenderer.svelte`
- Possibly `src/lib/utils/audio-recording.ts` (new helper, if component gets bulky)

Tasks:

- Implement Svelte 5 component with states:
  - idle,
  - requesting permission,
  - recording,
  - processing,
  - answered,
  - error.
- Use `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`.
- Keep recording short:
  - default max 12 seconds,
  - auto-stop at max duration,
  - allow manual stop,
  - release media tracks after stop/cancel.
- Submit `FormData` to `/api/speaking/check` with audio plus minimal exercise metadata.
- Display:
  - prompt,
  - expected response hidden until answered,
  - transcript after processing,
  - AI-verified correct/not-quite result,
  - expected Japanese + romaji after answer,
  - retry option before continuing if recording failed or transcript is empty.
- Accessibility/UX:
  - clear “Allow microphone” state,
  - visible recording timer,
  - no auto-recording on load,
  - keyboard-operable buttons,
  - `aria-live` for status changes.
- Browser support fallback:
  - if `MediaRecorder` or `mediaDevices` is unavailable, show a typed fallback input or a clear “voice recording is not supported in this browser” message.
  - Recommendation: include typed fallback for development and unsupported browsers, but still submit through the same grading logic with a flag indicating no audio. If this bloats the first pass, make fallback an explicit follow-up.

### 6. Wire renderer

Files:

- `src/lib/components/SessionRenderer.svelte`

Tasks:

- Import `SpeakingExercise.svelte`.
- Add `{:else if exercise.type === 'speaking'}` branch.
- Ensure keyed reset behavior works when switching exercises.

### 7. Practice mode and stored sessions

Files:

- `src/lib/server/practice.ts`
- Possibly tests in `src/lib/server/practice.test.ts`

Tasks:

- Practice currently reuses previous exercise JSON. It should work automatically if `SessionRenderer` supports `speaking`.
- Verify practice selection does not assume a fixed set of six types.
- Decide whether practice sessions should include speaking exercises immediately. Default: yes, because they are just stored exercises, but document that microphone availability can affect practice usability.

### 8. Public portfolio challenge boundary

Files to inspect, probably not change for MVP:

- `src/lib/server/ai-public-challenge.ts`
- `src/lib/server/portfolio-challenge.ts`
- `src/routes/portfolio/challenge/+page.svelte`

Recommendation:

- Do not add speaking to public portfolio challenge in the first pass. Public demo should remain low-friction and not require microphone permissions.
- Ensure any public challenge prompt/type lists still use beginner rules intentionally and do not start generating speaking exercises accidentally. If `LEVEL_RULES.beginner` gains `speaking`, public challenge may need an explicit allowed-type override. This is the main trap in the plan.

### 9. Documentation

Files:

- `documents/plans/ai-session-guidelines.md`
- Possibly `README.md` if API route summary should mention `/api/speaking/check`

Tasks:

- Document speaking exercise standards:
  - where it is allowed by level,
  - accepted answer/rubric expectations,
  - romaji requirements,
  - privacy rule: raw audio is transient and not stored.
- If adding a new API route, update README route list only if the project expects it to remain exhaustive.

## Files likely to change

Core:

- `src/lib/types.ts`
- `src/lib/server/ai-session-prompts.ts`
- `src/lib/server/ai-session-normalizers.ts`
- `src/lib/components/SessionRenderer.svelte`
- `src/lib/components/exercises/SpeakingExercise.svelte` (new)
- `src/lib/server/speaking-checker.ts` (new)
- `src/routes/api/speaking/check/+server.ts` (new)

Tests:

- `src/lib/server/ai-session-normalizers.test.ts`
- `src/lib/server/ai-session-prompts.test.ts`
- `src/lib/server/answer-checker.ts` tests if present or new helper tests
- API/helper test for speaking route if existing route test patterns support it

Docs:

- `documents/plans/ai-session-guidelines.md`
- `README.md` if adding API route documentation

Potentially inspect/change to avoid accidental public microphone requirement:

- `src/lib/server/ai-public-challenge.ts`
- `src/lib/server/portfolio-challenge.ts`
- `src/routes/portfolio/challenge/+page.svelte`

## Tests / validation

Before editing during implementation:

- `git status --short --branch`
- Inspect current route/helper test patterns.

Targeted tests to add/run:

- `npm test -- src/lib/server/ai-session-normalizers.test.ts`
- `npm test -- src/lib/server/ai-session-prompts.test.ts`
- targeted test for speaking checker helper if added
- targeted component/view-model tests if any helper logic is extracted

Full validation before final handoff:

- `npm run validate:ci`

Manual browser validation:

- Start dev server with `npm run dev`.
- Generate or fixture a session containing a `speaking` exercise.
- Verify microphone permission flow.
- Verify recording starts/stops and releases the mic indicator.
- Verify a short Japanese answer returns a transcript and graded result.
- Verify empty/noisy audio returns a recoverable error, not a completed answer.
- Verify unsupported browser fallback.
- Verify practice mode can render a stored speaking exercise.
- Verify public portfolio challenge does not ask for microphone unless explicitly intended.

## Risks, tradeoffs, and open questions

### Risks

- Browser recording support varies. `MediaRecorder` is broadly available but not universal, and MIME formats differ by browser.
- OpenAI transcription may mis-hear beginner pronunciation. Grading should show the transcript so the learner can see what was heard.
- Adding `speaking` to `LEVEL_RULES.beginner` may unintentionally affect public challenge generation if that path reuses beginner prompt rules. Guard this explicitly.
- Audio uploads can be large or sensitive. Enforce size/time limits and do not persist raw audio.
- Token/cost accounting for transcription may not be as straightforward as text Responses usage.

### Tradeoffs

- Combined `/api/speaking/check` route is simpler for MVP but less reusable than separate `/api/speech/transcribe` and `/api/check-answer` calls.
- Server transcription is more reliable than browser Web Speech API and works across browsers, but costs money and sends audio to OpenAI.
- A typed fallback improves accessibility and development ergonomics but blurs the “voice exercise” concept. It is still worth considering for unsupported browsers.

### Open questions

- Which OpenAI transcription model/API should be used with the installed `openai@^6.32.0` SDK?
- Should speaking exercises be allowed for `beginner`, or only `elementary+` to avoid frustrating early learners?
- Should the learner be allowed to retry after an incorrect spoken answer before the exercise is marked complete?
- Should spoken translation require Japanese script in expected answers only, or should romaji spoken/typed variants be accepted for low levels?
- Should microphone exercises be generated by default, or behind a user/profile preference such as `speakingExercisesEnabled`?

## Suggested implementation order

1. Types + normalizer + prompt rules + tests.
2. Server speaking checker helper + API route + tests.
3. UI component + renderer wiring.
4. Public challenge guard if needed.
5. Documentation updates.
6. Full validation and manual browser test.

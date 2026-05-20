# Exercise UI Harmonisation Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Keep UI lanes coordinated: do not let multiple agents edit `src/app.css`, `SessionRenderer.svelte`, or the exercise component directory at the same time. This is a maintenance/refactor plan, not a feature redesign.

**Goal:** Make all Japanese Learner exercise types feel like one coherent app, then document and test the UI contract so future agents do not re-diverge it.

**Architecture:** Introduce a small shared exercise UI layer for frame, prompt, actions, statuses, and results; migrate each exercise component onto it while preserving existing exercise logic and type-specific affordances. Extend the existing warm washi design-token system in `src/app.css`, remove undefined/fallback tokens from exercise UI, and add lightweight documentation plus Vitest contract tests that catch hard-coded visual drift.

**Tech stack:** SvelteKit 2, Svelte 5 runes, TypeScript, scoped Svelte styles, global design tokens in `src/app.css`, Vitest for static UI-contract tests.

**Created:** 2026-05-20 12:50:02 EEST

**Status:** in progress

## Implementation progress

- 2026-05-20: Task 0 complete. Preflight read `AGENTS.md`, `README.md`, `documents/CONTRIBUTING.md`, `documents/INDEX.md`, and this plan. Baseline `git status --short --branch` was `## master...origin/master` with only this untracked `.hermes/` plan present. Baseline `npm run check` passed with 0 errors and 0 warnings.
- 2026-05-20: Task 1 complete. Added `documents/design/exercise-ui-guidelines.md`, linked it from `AGENTS.md`, `documents/CONTRIBUTING.md`, and `documents/INDEX.md`, and validated with `npm run format:check`.
- 2026-05-20: Task 2 complete. Added shared `ExerciseFrame`, `ExerciseResultPanel`, and `ExerciseStatusPanel` primitives under `src/lib/components/exercises/shared/`; validation `npm run check` passed.
- 2026-05-20: Task 3 complete. Added the static exercise UI contract test covering shared `ExerciseFrame` usage, raw colour bans, fallback token bans, token definition checks, Translation button-class drift, and `SessionRenderer` error tokenisation. It was kept uncommitted while intentionally RED, then committed once migrations and Task 9 made it GREEN; `npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts` passed.
- 2026-05-20: Task 4 complete. Added exercise rhythm tokens and shared exercise utility classes to `src/app.css`; `npm run check` passed. The Task 3 contract test still fails as expected until component migrations are complete.
- 2026-05-20: Task 5 complete. Migrated `FillBlankExercise`, `ReorderExercise`, and `ReadingExercise` to `ExerciseFrame`/`ExerciseResultPanel`/`ExerciseStatusPanel` as applicable. `npm run check` passed; the contract test now reports remaining drift only in choice, translation, speaking, and SessionRenderer lanes.
- 2026-05-20: Task 6 complete. Migrated `MultipleChoiceExercise` and `ListeningExercise` to `ExerciseFrame`/`ExerciseResultPanel`, shared choice/action rhythm, and token-only choice states. `npm run check` passed; the contract test now reports remaining drift only in `TranslationExercise`, `SpeakingExercise`, and `SessionRenderer`.
- 2026-05-20: Task 7 complete. Migrated `TranslationExercise` to `ExerciseFrame`, global button classes, `ExerciseStatusPanel`, and `ExerciseResultPanel` while preserving AI verification, hints, accepted answers, and focus announcement flow. `npm run check` and `translation-exercise-view-model.test.ts` passed; the contract test now reports remaining drift only in `SpeakingExercise` and `SessionRenderer`.
- 2026-05-20: Task 8 complete. Migrated `SpeakingExercise` to `ExerciseFrame`, duration meta, `ExerciseStatusPanel`, `ExerciseResultPanel`, shared action rhythm, and token-only styling while preserving microphone recording, retry, backend submission, and continue-without-credit flow. `npm run check`, speaking API/server tests, and all exercise contract checks except the planned `SessionRenderer` error-colour case passed.
- 2026-05-20: Task 9 complete. Tokenised `SessionRenderer` unknown-exercise error styling and changed the portfolio challenge active state to render progress in its own card with `SessionRenderer` outside it, matching learn/practice frame ownership. `npm run check`, portfolio view-model tests, and the exercise UI contract test passed.

---

## Goal

Harmonise the exercise experience across:

- `multiple_choice`
- `translation`
- `fill_blank`
- `reorder`
- `reading`
- `listening`
- `speaking`

The implementation should make them share the same frame, spacing rhythm, button treatment, result treatment, status/error treatment, and token vocabulary while still keeping each exercise type recognisable.

## Scope

In scope:

- Refactor exercise component presentation only.
- Preserve current exercise data shapes, scoring semantics, submit/continue flow, API calls, TTS behaviour, microphone behaviour, and storage behaviour.
- Add shared exercise UI primitives under `src/lib/components/exercises/shared/`.
- Add or refine design tokens in `src/app.css` where the existing token set is missing exercise-level concepts.
- Remove undefined token names and Tailwind-looking fallback colours from exercise UI.
- Align learn, practice, and portfolio active-session exercise framing.
- Add documentation so agents know what to use next time.
- Add static contract tests so divergence is caught before review.

Non-goals:

- No new exercise types.
- No AI prompt changes.
- No DB schema changes.
- No scoring/answer-normalisation changes.
- No broad redesign of home, missions, progress, or portfolio summary pages beyond token hygiene directly needed by this work.
- No new visual regression test dependency unless Tuukka explicitly approves it later.

## Current context / evidence from codebase inspection

Project constraints discovered before planning:

- Root guide says to use SvelteKit 2, Svelte 5 runes, TypeScript strict mode, server-only code in `src/lib/server/`, and design tokens from `src/app.css`.
- `documents/CONTRIBUTING.md` defines the app design as a warm Japanese washi paper aesthetic and requires significant plans/docs to be recorded.
- Current branch state was clean: `## master...origin/master`.
- `package.json` has no browser/VRT tooling; validation is currently `npm run validate:ci`.

Visual/UI inconsistencies found in the exercise layer:

1. Exercise shell inconsistency
   - Most exercise components render `<section class="card">`.
   - `TranslationExercise.svelte` renders `<section class="translation-exercise">` with its own `padding: var(--space-6)`, `max-width: 32rem`, and `margin: 0 auto`, so it opt-outs from the shared `.card` surface.
   - `SpeakingExercise.svelte` uses `card` but adds its own grid/gap shell.
   - `portfolio/challenge/+page.svelte` wraps `SessionRenderer` inside `<section class="card active-card">`, while the exercise components render their own cards. That creates nested card treatment in portfolio, unlike learn/practice.

2. Answer/action spacing is not governed by one rule
   - Fill blank, reorder, and reading use `.answer-area { display: grid; gap: var(--space-3); margin-top: var(--space-3); }`.
   - Multiple choice uses `.choices { gap: var(--space-2); margin-bottom: var(--space-3); }` and then `.btn { width: 100%; margin-top: var(--space-4); }`.
   - Listening groups audio buttons and choices with the same `gap: var(--space-2); margin-bottom: var(--space-3);` and makes all `.btn` width 100%.
   - Translation has a separate `.button-row { margin-top: var(--space-4); }`, custom `hint-btn`, `check-btn`, and `continue-btn`, and a result panel with `margin-top: var(--space-6)`.
   - Speaking uses `gap: var(--space-4, 1rem)` at the shell level and flex-wrapped actions.

3. Result panels duplicate the same concept seven ways
   - Fill blank, reorder, and reading have identical/simple `.result-panel` rules.
   - Multiple choice adds `margin-top`, animation, fallback token values, and larger result text.
   - Listening uses `margin-bottom` instead of `margin-top`.
   - Translation has a more elaborate result layout with accepted answers and `padding: var(--space-5)`.
   - Speaking uses state-coloured result backgrounds and a two-column answer grid, with several undefined/fallback tokens.

4. Button language drifts
   - Global `src/app.css` already defines `button`, `.btn`, `.btn-primary`, `.btn-secondary`, and `.btn-ghost`.
   - Translation bypasses this with `.hint-btn`, `.check-btn`, and `.continue-btn`.
   - Some pages use `class="btn-primary"` directly, while most exercise components use `class="btn btn-primary"`. Both are supported globally, but exercises should use one convention.

5. Token hygiene has started to slip
   - Exercise scan found undefined/fallback-style tokens in `SpeakingExercise.svelte`: `--text-muted`, `--border-subtle`, `--accent-kin`.
   - Speaking also contains Tailwind-looking fallback colours: `#64748b`, `#dbe4ee`, `#f59e0b`, `#f8fafc`, `#dc2626`, `#16a34a`, `#dcfce7`, `#fee2e2`.
   - Multiple choice and listening still contain fallback colours for success/error washes.
   - `SessionRenderer.svelte` uses a raw `#dc2626` for unknown exercise errors.
   - Wider non-exercise token typos surfaced during scan: `--border-medium`, `--weight-normal`, `--radius-full`, and component-local variables in `PortfolioBehindTheScenes.svelte`. These should be fixed or intentionally documented, but keep that as a small token-hygiene pass, not a redesign.

6. Documentation gap
   - `src/app.css` contains strong design-token comments, but there is no concise exercise UI contract saying how a new exercise should be structured.
   - `AGENTS.md` says to use design tokens, but it does not define what “same app” means for exercise components.

## Proposed approach

Use a two-layer approach:

1. Shared primitives for repeated exercise UI
   - Add `src/lib/components/exercises/shared/ExerciseFrame.svelte`.
   - Add `src/lib/components/exercises/shared/ExerciseResultPanel.svelte`.
   - Add `src/lib/components/exercises/shared/ExerciseStatusPanel.svelte`.
   - Add `src/lib/components/exercises/shared/ExerciseActions.svelte` only if it keeps components simpler; otherwise use documented `.exercise-actions` classes from `src/app.css`.

2. Token and documentation contract
   - Keep durable visual values in `src/app.css`.
   - Avoid component-local fallback values like `var(--text-muted, #64748b)` in app-owned components; if a token is needed, define it deliberately or use an existing token.
   - Add `documents/design/exercise-ui-guidelines.md` as the source of truth for future agents.
   - Update `documents/CONTRIBUTING.md`, `documents/INDEX.md`, and possibly `AGENTS.md` to point future work at the exercise UI contract.
   - Add static Vitest tests that fail when exercise components use undefined tokens, raw hex colours, or skip the shared exercise frame.

Preferred visual contract:

- One exercise = one card-like frame, owned by the exercise renderer/component layer.
- Session progress is a separate card above the exercise in private learn/practice and public portfolio.
- Standard exercise card width follows the page container unless a component has a documented reason to constrain content internally.
- Exercise card internal rhythm:
  - frame gap: `var(--space-4)`
  - prompt-to-answer gap: `var(--space-4)` or `var(--space-6)` for large Japanese prompt displays
  - answer control group gap: `var(--space-3)`
  - submit/continue action gap: `var(--space-4)`
  - result panel padding: `var(--space-4)` by default, `var(--space-5)` only if dense result content needs it
- Type-specific affordances are allowed but must live inside the common frame:
  - translation direction badge
  - listening audio controls
  - speaking duration/privacy status
  - multiple-choice selected/correct/incorrect choices
  - reading passage and romaji

## Affected files

| Path                                                             | Expected change                                                                                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app.css`                                                    | Add exercise-level tokens/classes if needed; fix obvious token aliases/typos; keep washi aesthetic.  |
| `src/lib/components/SessionRenderer.svelte`                      | Use tokenised error styling; optionally pass/coordinate frame ownership if needed.                   |
| `src/lib/components/exercises/shared/ExerciseFrame.svelte`       | Create shared exercise shell.                                                                        |
| `src/lib/components/exercises/shared/ExerciseResultPanel.svelte` | Create shared result treatment for correct/incorrect/neutral result panels.                          |
| `src/lib/components/exercises/shared/ExerciseStatusPanel.svelte` | Create shared loading/checking/error/warning panel treatment.                                        |
| `src/lib/components/exercises/MultipleChoiceExercise.svelte`     | Migrate onto shared shell/result/actions; keep choice-state logic.                                   |
| `src/lib/components/exercises/TranslationExercise.svelte`        | Migrate onto shared shell, remove custom button styling, align input/result spacing.                 |
| `src/lib/components/exercises/FillBlankExercise.svelte`          | Migrate onto shared shell/result/status; preserve AI check logic.                                    |
| `src/lib/components/exercises/ReorderExercise.svelte`            | Migrate onto shared shell/result.                                                                    |
| `src/lib/components/exercises/ReadingExercise.svelte`            | Migrate onto shared shell/result.                                                                    |
| `src/lib/components/exercises/ListeningExercise.svelte`          | Migrate onto shared shell/result/actions while keeping audio controls.                               |
| `src/lib/components/exercises/SpeakingExercise.svelte`           | Replace undefined tokens/fallback colours, align status/result/actions, keep microphone flow.        |
| `src/routes/portfolio/challenge/+page.svelte`                    | Align active exercise framing with learn/practice; avoid nested card surface.                        |
| `src/lib/components/exercises/exercise-ui-contract.test.ts`      | Create static guardrail tests for exercise UI contract.                                              |
| `documents/design/exercise-ui-guidelines.md`                     | Create future-agent design contract and examples.                                                    |
| `documents/CONTRIBUTING.md`                                      | Reference exercise UI guidelines in Svelte/design section.                                           |
| `documents/INDEX.md`                                             | Add the new design guideline document and mark this plan appropriately if later copied to repo docs. |
| `AGENTS.md`                                                      | Optional small pointer: exercise components must use the documented exercise UI contract.            |

## Implementation tasks

### Task 0: Preflight and baseline capture

**Objective:** Confirm the implementer starts from a clean, current state and has read the required project docs.

**Files:** none.

**Steps:**

1. Run:

   ```bash
   git status --short --branch --untracked-files=all
   git log -1 --oneline
   ```

2. Confirm there are no unexpected user changes. If there are, stop and record them before editing.
3. Read:
   - `AGENTS.md`
   - `README.md`
   - `documents/CONTRIBUTING.md`
   - `documents/INDEX.md`
   - this plan
4. Inspect current exercise components before editing:

   ```bash
   npm run check
   ```

   Expected: should pass before the refactor starts. If it does not, record the pre-existing failure and do not hide it inside the UI refactor.

### Task 1: Document the exercise UI contract first

**Objective:** Create the source-of-truth guidance before touching components, so implementation has something to conform to.

**Files:**

- Create: `documents/design/exercise-ui-guidelines.md`
- Modify: `documents/CONTRIBUTING.md`
- Modify: `documents/INDEX.md`
- Optional modify: `AGENTS.md`

**Content requirements for `documents/design/exercise-ui-guidelines.md`:**

- State the app aesthetic: warm Japanese washi paper, calm, generous, token-driven.
- Define exercise frame ownership: `SessionRenderer`/exercise components own one exercise card; route pages own progress cards, not nested exercise cards.
- Define required structure for all exercise types:
  1. frame/header
  2. prompt/content
  3. answer controls
  4. transient status, if needed
  5. result panel, if answered
  6. primary action row
- Define spacing rules using existing tokens.
- Define allowed button classes: `btn btn-primary`, `btn btn-secondary`, `btn btn-ghost`.
- Define result/status language:
  - success: `state-success` + `accent-matcha-wash`
  - error/incorrect: `state-error` + `accent-shu-wash`
  - neutral/status: `bg-washi` or `bg-kinu`
- Define token rules:
  - no raw hex colours in exercise components
  - no undefined token fallbacks in app-owned exercise UI
  - no new visual tokens without adding them to `src/app.css` and documenting the reason
- Include a short “adding a new exercise type” checklist.

**Validation:**

Run:

```bash
npm run format:check
```

Expected: either passes, or only reports files changed in this task that need formatting.

### Task 2: Add shared exercise primitives

**Objective:** Create a small, boring UI layer that removes the duplicated card/result/status styling without turning exercise logic into abstraction soup. Yes, the boring part is intentional.

**Files:**

- Create: `src/lib/components/exercises/shared/ExerciseFrame.svelte`
- Create: `src/lib/components/exercises/shared/ExerciseResultPanel.svelte`
- Create: `src/lib/components/exercises/shared/ExerciseStatusPanel.svelte`
- Optional create: `src/lib/components/exercises/shared/ExerciseActions.svelte`

**Implementation notes:**

- Use Svelte 5 runes/snippet-compatible props.
- Keep props narrow and explicit.
- Do not move exercise answer logic into shared components.
- Do not introduce a full component library.

Suggested primitives:

1. `ExerciseFrame.svelte`
   - Props: `title`, `ariaLabel`, optional `kicker`, optional `meta`, optional `className` if Svelte style/class forwarding is awkward.
   - Renders one `.card`-based frame with a `.exercise-frame` class.
   - Provides slots/snippets for prompt/body/actions.

2. `ExerciseResultPanel.svelte`
   - Props: `state: 'correct' | 'incorrect' | 'neutral'`, `title`, optional `aiVerified`, optional `showReward = true`.
   - Provides a details slot/snippet for expected answers, accepted answers, transcript, etc.

3. `ExerciseStatusPanel.svelte`
   - Props: `tone: 'neutral' | 'warning' | 'error' | 'success'`, optional `role`.
   - Used by translation/fill blank checking indicators and speaking microphone states.

If snippets make these components more complex than the repeated CSS they replace, fall back to global `.exercise-*` classes in `src/app.css` plus a single `ExerciseFrame.svelte`. The goal is consistency, not ceremony.

**Validation:**

Run:

```bash
npm run check
```

Expected: passes while the new components are unused.

### Task 3: Add exercise UI contract tests

**Objective:** Make future visual drift noisy in CI.

**Files:**

- Create: `src/lib/components/exercises/exercise-ui-contract.test.ts`

**Test cases:**

1. Every first-party exercise component under `src/lib/components/exercises/*.svelte` imports or renders the shared exercise frame, except files in `shared/` and non-exercise helpers.
2. Exercise component `<style>` blocks do not contain raw hex colours.
3. Exercise component `<style>` blocks do not use `var(--token, fallback)` fallback syntax for app-owned design tokens.
4. Every `var(--token)` used by exercise components exists in `src/app.css`.
5. Translation no longer uses `.hint-btn`, `.check-btn`, or `.continue-btn`; it should use global button classes/shared action classes.
6. `SessionRenderer.svelte` should not contain raw hex error colours.

Keep the test pragmatic:

- Allow `-1px`/clip values for `.sr-only` only if a component still needs local sr-only CSS. Prefer using global `.sr-only` from `src/app.css` instead.
- Do not scan generated `.svelte-kit`, `.vercel`, or `node_modules`.

**Validation:**

Run:

```bash
npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected at first: tests may fail until migration tasks are complete. Commit this only after either marking failing cases with TODOs for the same branch or finishing the migrations. Prefer finishing the migrations before commit.

### Task 4: Token hygiene in `src/app.css`

**Objective:** Give shared exercise UI the tokens it actually needs and remove accidental token names.

**Files:**

- Modify: `src/app.css`

**Steps:**

1. Add exercise-level custom properties only if they reduce repeated component values. Suggested names:
   - `--exercise-frame-gap`
   - `--exercise-control-gap`
   - `--exercise-action-gap`
   - `--exercise-result-padding`
2. Prefer mapping to existing spacing tokens:
   - frame gap: `var(--space-4)`
   - control gap: `var(--space-3)`
   - action gap: `var(--space-4)`
   - result padding: `var(--space-4)`
3. Do not add `--text-muted`, `--border-subtle`, or `--accent-kin` unless there is a deliberate reason. Current design system already has `--text-bokashi`, `--text-usuzumi`, `--border-light`, `--border-mid`, and `--state-warning`.
4. If fixing wider token typos in the same pass, keep it mechanical:
   - `--border-medium` -> `--border-mid`
   - `--weight-normal` -> `--weight-regular`
   - `--radius-full` -> either define `--radius-full: 999px` in `src/app.css` or replace local uses with `999px` only where pill geometry is intentional. Prefer defining the token if it appears more than once.

**Validation:**

Run:

```bash
npm run check
npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: check passes; contract test may still fail for unmigrated exercise files until later tasks.

### Task 5: Migrate simple typed-answer exercises

**Objective:** Harmonise the lowest-risk components first and prove the shared frame/result API is usable.

**Files:**

- Modify: `src/lib/components/exercises/FillBlankExercise.svelte`
- Modify: `src/lib/components/exercises/ReorderExercise.svelte`
- Modify: `src/lib/components/exercises/ReadingExercise.svelte`

**Steps:**

1. Wrap each component in `ExerciseFrame` instead of local `<section class="card">`.
2. Replace duplicated `.answer-area` CSS with either shared component classes or shared frame/action classes.
3. Replace local `.result-panel`, `.result-correct`, `.result-incorrect`, `.ink-reward` blocks with `ExerciseResultPanel`.
4. Use `ExerciseStatusPanel` for fill blank's `checking` state.
5. Preserve all current `submit`, `continueToNext`, AI-check, and reset logic.
6. Preserve existing Japanese/romaji display and inline audio behaviour.

**Validation:**

Run:

```bash
npm run check
npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: TypeScript passes; contract failures should shrink to the remaining unmigrated components.

### Task 6: Migrate choice-based exercises

**Objective:** Make multiple choice and listening share one choice/action/result rhythm.

**Files:**

- Modify: `src/lib/components/exercises/MultipleChoiceExercise.svelte`
- Modify: `src/lib/components/exercises/ListeningExercise.svelte`

**Steps:**

1. Wrap both in `ExerciseFrame`.
2. Standardise choice grid spacing to the documented value.
3. Keep choice state classes (`selected`, `correct`, `incorrect`, `dimmed`) but remove fallback colours.
4. Prefer shared class names if useful:
   - `.exercise-choice-grid`
   - `.exercise-choice-button`
5. Ensure submit/continue buttons use the same full-width treatment across both components.
6. For listening, keep audio controls visually distinct but inside the shared action/status rhythm.

**Validation:**

Run:

```bash
npm run check
npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: TypeScript passes; no raw colours/fallback tokens remain in these two components.

### Task 7: Migrate TranslationExercise carefully

**Objective:** Bring the most divergent component back into the app system without losing its richer translation affordances.

**Files:**

- Modify: `src/lib/components/exercises/TranslationExercise.svelte`

**Steps:**

1. Replace `<section class="translation-exercise">` with `ExerciseFrame`.
2. Keep the direction badge, but style it with existing tokens and shared header/meta conventions.
3. Keep the large Japanese/English prompt display, but align spacing with the documented prompt/content rhythm.
4. Replace `.hint-btn`, `.check-btn`, and `.continue-btn` with global/shared button classes:
   - hint: `btn btn-secondary` or `btn btn-ghost`
   - check: `btn btn-primary`
   - continue: `btn btn-primary`
5. Keep the AI verification badge and accepted answers, but render them inside `ExerciseResultPanel` details.
6. Use global `.sr-only` instead of local sr-only CSS if possible.
7. Remove bespoke max-width unless manual QA proves translation needs it. If it does need narrower content, document that as an internal prompt/content max width, not a different outer frame.

**Validation:**

Run:

```bash
npm run check
npm test -- src/lib/components/exercises/translation-exercise-view-model.test.ts src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: translation view-model tests still pass; contract test no longer flags TranslationExercise.

### Task 8: Migrate SpeakingExercise and remove foreign-token drift

**Objective:** Make the newest exercise type look native to this app rather than like it was parachuted in from a Tailwind tutorial. A tragic but common fate.

**Files:**

- Modify: `src/lib/components/exercises/SpeakingExercise.svelte`

**Steps:**

1. Replace undefined/fallback tokens:
   - `--text-muted` -> `--text-bokashi` or `--text-usuzumi`
   - `--border-subtle` -> `--border-light`
   - `--accent-kin` -> `--state-warning` or `--accent-gold`
2. Remove raw fallback colours from `var()` usages.
3. Wrap in `ExerciseFrame` and keep the duration pill as frame meta.
4. Render unsupported/requesting/recording/processing/error states through `ExerciseStatusPanel` or shared status classes.
5. Render transcript/expected answer through `ExerciseResultPanel` details.
6. Preserve microphone permissions, timers, cleanup, `/api/speaking/check` submission, retry/error handling, and continue-without-credit behaviour.
7. Keep the privacy note, but align its type/spacing with documented note styles.

**Validation:**

Run:

```bash
npm run check
npm test -- src/routes/api/speaking/check.server.test.ts src/lib/server/speaking-checker.test.ts src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: speaking backend tests still pass; contract test no longer flags SpeakingExercise.

### Task 9: Align SessionRenderer and route framing

**Objective:** Ensure the same exercise component renders consistently in learn, practice, and portfolio.

**Files:**

- Modify: `src/lib/components/SessionRenderer.svelte`
- Modify: `src/routes/portfolio/challenge/+page.svelte`
- Optional inspect only: `src/routes/learn/+page.svelte`
- Optional inspect only: `src/routes/practice/+page.svelte`

**Steps:**

1. Replace raw `#dc2626` error styling in `SessionRenderer.svelte` with design tokens.
2. Decide final frame ownership:
   - Preferred: route pages render progress in a separate `.card`; exercise components render exactly one exercise frame/card.
3. Update portfolio active state to match learn/practice:
   - render progress in its own card
   - render `SessionRenderer` outside that card
   - remove nested exercise card behaviour
4. Keep portfolio public challenge restrictions untouched. This is UI framing only.

**Validation:**

Run:

```bash
npm run check
npm test -- src/routes/portfolio/challenge/portfolio-challenge-view-model.test.ts src/lib/components/exercises/exercise-ui-contract.test.ts
```

Expected: no type regressions; portfolio view-model tests unaffected.

### Task 10: Finish docs and update index

**Objective:** Leave future agents with clear instructions instead of another folklore-based styling system. Folklore scales poorly, as we have just demonstrated.

**Files:**

- Modify: `documents/design/exercise-ui-guidelines.md`
- Modify: `documents/CONTRIBUTING.md`
- Modify: `documents/INDEX.md`
- Optional modify: `AGENTS.md`

**Steps:**

1. Update the design guideline with the final shared component names and examples.
2. In `documents/CONTRIBUTING.md`, add a short rule under Svelte Components:
   - exercise UI must use the shared exercise frame/result/status primitives
   - use `src/app.css` tokens only
   - run the exercise UI contract test when changing exercises
3. In `documents/INDEX.md`, add the new design guideline as an active guide.
4. If `AGENTS.md` is updated, keep it one short bullet so the boot guide does not become a design essay.

**Validation:**

Run:

```bash
npm run format:check
```

Expected: formatting check passes or points to files to format before final validation.

### Task 11: Full validation and manual visual QA

**Objective:** Prove the refactor preserved behaviour and improved consistency.

**Files:** none unless fixes are needed.

**Automated validation:**

Run:

```bash
npm run validate:ci
```

Expected: passes.

**Manual visual QA checklist:**

1. Start the app locally:

   ```bash
   npm run dev
   ```

2. Use the DebugPanel to generate each exercise type in practice mode:
   - multiple choice
   - translation
   - fill blank
   - reorder
   - reading
   - listening
   - speaking
3. For each type, check these states:
   - initial unanswered state
   - disabled submit state where applicable
   - checking/processing state where applicable
   - correct answer state
   - incorrect answer state
   - continue action state
4. Check at three viewport widths:
   - narrow mobile around 375px
   - tablet around 768px
   - desktop within the normal app container
5. Verify visually:
   - one exercise card, not nested cards
   - answer input/control to submit button spacing is consistent
   - result panel placement feels consistent
   - success/error colours match the washi/matcha/shu palette
   - no component suddenly looks like a different design system
   - focus-visible outlines remain visible
   - speaking states are understandable without trapping the learner
6. Check public portfolio challenge active exercise state:
   - progress and exercise framing matches private learn/practice
   - no speaking exercise appears in public challenge
   - no nested card surface around `SessionRenderer`

## Acceptance criteria

- All exercise components render through the shared exercise frame or documented shared `.exercise-*` contract.
- `TranslationExercise.svelte` no longer has a divergent outer shell, custom submit/continue button styling, or local sr-only copy if global utility can be used.
- `SpeakingExercise.svelte` no longer uses `--text-muted`, `--border-subtle`, `--accent-kin`, or raw Tailwind-style fallback colours.
- Choice-based components share the same choice grid and selected/correct/incorrect visual language.
- Typed-answer components share the same answer-control spacing and result panel treatment.
- Result panels have a consistent success/error/neutral structure while allowing richer details for translation and speaking.
- Learn, practice, and portfolio active exercise states do not nest card surfaces inconsistently.
- New documentation exists and is linked from the contribution/index docs.
- A static contract test catches raw colours, undefined tokens, fallback design tokens, and missing shared frame usage in exercise components.
- `npm run validate:ci` passes.
- Manual QA confirms the seven exercise types feel like one app at mobile, tablet, and desktop widths.

## Risks, tradeoffs, and open questions

- Shared components can become too clever. Keep the first pass deliberately small: frame, result, status, maybe actions. Do not build a private UI framework inside a hobby tutor.
- Translation legitimately needs richer prompt and result treatment. Harmonise the frame and rhythm; do not flatten useful learning affordances just to make components identical.
- Speaking needs more states than other exercises. It should still use shared status/result tones, but it can keep microphone-specific controls and privacy copy.
- Static tests catch token drift, not actual rendered layout. If visual regressions continue after this pass, consider adding Playwright screenshot tests later, but that is a separate tooling decision.
- Portfolio has a public-demo tone. It can keep public-demo intro/summary styling, but the actual exercise renderer should not look like a different component stack.

## Suggested implementation order / commit boundaries

1. `docs: add exercise ui guidelines`
2. `refactor: add shared exercise ui primitives`
3. `test: add exercise ui contract guardrails`
4. `refactor: harmonise typed answer exercises`
5. `refactor: harmonise choice exercises`
6. `refactor: harmonise translation exercise`
7. `refactor: harmonise speaking exercise`
8. `refactor: align portfolio exercise framing`
9. `docs: record exercise ui contract in contributor guide`
10. `chore: validate exercise ui harmonisation`

Frequent commits are recommended because this touches many visually similar files and merge conflicts will otherwise be tedious. Naturally.

# Exercise UI Guidelines

Created: 2026-05-20

This guide defines the shared visual contract for Japanese Learner exercise components. Use it when adding or editing any component under `src/lib/components/exercises/`.

## Aesthetic

Exercise UI should feel like the rest of the app: warm Japanese washi paper, calm spacing, generous touch targets, and token-driven styling from `src/app.css`. Components should preserve learning affordances, but they should not introduce a new visual system.

## Frame ownership

- One exercise renders as one card-like exercise frame.
- Exercise components, through the shared exercise UI primitives, own that exercise frame.
- Route pages own session progress, scenario, intro, and summary cards.
- Do not wrap `SessionRenderer` in another card when the rendered exercise already owns its frame.
- If an exercise needs narrower content, constrain an inner prompt or control group and document why. Do not replace the outer frame.

## Required exercise structure

Every exercise should follow this order:

1. Frame/header: title, optional kicker, and optional compact meta.
2. Prompt/content: the learner-facing Japanese, English, audio, passage, or instruction content.
3. Answer controls: choices, text input, word bank, recorder controls, or equivalent.
4. Transient status, if needed: checking, recording, processing, warning, or unavailable state.
5. Result panel, if answered: success, incorrect/error, or neutral feedback.
6. Primary action row: submit, retry, continue, or continue-without-credit actions.

Type-specific affordances are expected. Examples: translation direction badges, listening audio controls, speaking privacy state, multiple-choice selected/correct/incorrect choices, and reading passage formatting.

## Spacing rhythm

Use existing spacing tokens, or exercise-level aliases that map to them in `src/app.css`:

- Frame gap: `var(--exercise-frame-gap)` or `var(--space-4)`.
- Prompt-to-answer gap: `var(--space-4)`, or `var(--space-6)` for large Japanese prompt displays.
- Answer control group gap: `var(--exercise-control-gap)` or `var(--space-3)`.
- Submit/continue action gap: `var(--exercise-action-gap)` or `var(--space-4)`.
- Result panel padding: `var(--exercise-result-padding)` or `var(--space-4)`; use `var(--space-5)` only for dense details.

Keep the rhythm consistent before adding component-local spacing. Local spacing should explain a real affordance, not compensate for an incompatible shell.

## Buttons and actions

Exercise actions use the global button classes:

- Primary: `btn btn-primary`
- Secondary: `btn btn-secondary`
- Low-emphasis: `btn btn-ghost`

Do not add component-local button systems such as `.check-btn`, `.continue-btn`, or `.hint-btn`. If an action row needs layout, use shared exercise action classes or the shared exercise primitive rather than new visual styling.

## Result and status language

Use shared result/status primitives or their documented classes.

- Success/correct: success state text with matcha wash treatment.
- Incorrect/error: error state text with shu wash treatment.
- Neutral/status: washi or kinu background treatment.
- Warning/unavailable: warning state text with a subdued paper surface.

Rich details belong inside the result panel details area: accepted translations, expected answers, transcript comparison, and AI verification notes.

## Token rules

- Use design tokens from `src/app.css`.
- Do not use raw hex colours in exercise component styles.
- Do not use fallback syntax for app-owned tokens, such as `var(--text-muted, #64748b)`.
- Do not invent new visual tokens in a component. Add them to `src/app.css` first, with a clear reason, then use them consistently.
- Prefer existing text and border tokens such as `--text-bokashi`, `--text-usuzumi`, `--border-light`, and `--border-mid` before adding aliases.

## Adding a new exercise type checklist

Before review, confirm the new exercise:

- Uses the shared exercise frame/result/status primitives or the documented shared `.exercise-*` contract.
- Keeps exactly one exercise card frame in learn, practice, and portfolio routes.
- Uses only `src/app.css` tokens for styling.
- Uses `btn btn-primary`, `btn btn-secondary`, or `btn btn-ghost` for actions.
- Covers initial, disabled, transient status, correct, incorrect/error, and continue states where applicable.
- Runs `npm run check` and the exercise UI contract test.
- Updates this guide if it needs a genuinely new shared UI rule.

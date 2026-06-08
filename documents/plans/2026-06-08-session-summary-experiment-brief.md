# Session Summary Experiment Brief

Created: 2026-06-08

This brief captures the Experiment Lab decision for the Japanese Learner session summary redesign. The goal is to make the post-session screen worth reading after the learner has already received exercise-level feedback.

## Status

- Final outcome: Hone
- Current direction: locked prototype direction selected
- Locked prototype: `B4` — coach-note layout with A-style completion top
- Prototype artifact: `src/routes/prototype/session-summary/+page.svelte`
- Dev route: `/prototype/session-summary` or `/prototype/session-summary?variant=B4`
- Lock commit: `b87f3b4 chore: lock session summary prototype design`

## Original idea

The session summary page felt redundant. Score and ink breakdown were polished, but the “what went right / what went wrong” content often repeated feedback the learner already saw during exercises. The extra phrase felt useful, but the page needed a stronger post-session purpose.

## Problem / value

Immediate exercises already tell the learner whether they understood a phrase or confused one phrase with another. The summary should therefore avoid acting like a report card. It should add synthesis, transfer, nuance, memory, or one useful next move.

The page earns attention when it says: “I understood what happened, and here is the one useful thing you can carry forward.”

## Key decisions made

### Preserve the reward layer

- Keep score, celebration/stamp treatment, and ink breakdown.
- Reason: this part already feels polished and satisfying.

### Stop repeating per-exercise feedback

- Do not include content shaped like “you correctly understood X” or “you mixed up X with Y.”
- Reason: those are already covered in immediate exercise feedback and make the summary feel samey.

### Replace the audit grid with a carry-forward frame

- Remove the default “What you're mastering / What to work on” report-card frame as the main summary structure.
- Prefer a forward-looking synthesis frame: one useful pattern, one transfer sentence, one useful unlock.
- Reason: “mastering / work on” points backward; “carry forward” points to what changes because of the session.

### Keep one useful unlock as the main value add

- Promote the mini-lesson / useful phrase into the main reading area.
- It should teach a reusable pattern, not merely another example sentence.
- Japanese text must include romaji in parentheses where appropriate.

### Lock B4 as the design direction

B4 is the chosen prototype direction because it keeps the polished completion/reward affordance while giving the right side to the coach-note / useful unlock.

Keep in B4:

- left-side “Session complete” top treatment;
- A-style score stamp treatment;
- short AI summary sentence under the score;
- ink below the completion card;
- right-side coach-note card with one useful unlock;
- equal-sized “Return Home” and “Try Practice Mode” CTAs.

Do not reopen:

- the “Strong signal: polite openers” pill;
- unequal primary/secondary CTA sizing;
- a second exercise or re-drill after completion;
- the old backward-looking strengths/weaknesses grid as the default frame.

## Rejected options

### Keep the current audit grid but rewrite it better

Rejected because the frame itself invites duplicate exercise feedback. Better writing would still point backward.

### Make the summary mostly a score/ink receipt

Rejected as too thin. Score and ink are good, but the page still needs one additive learning moment.

### Add more next-practice direction before fixing the summary value

Deferred. Next-practice targeting can be useful, but only after the summary itself has a clear reason to exist.

## Prototype findings and verdict

- Variants explored: A, B1, B2, B3, B4.
- A preserved the current completion-card feel but was too close to the existing report shape.
- B1 moved toward a coach-note layout but needed the stronger A-style completion top.
- B4 combined the useful parts: A-style completion/reward on the left, coach-note / useful unlock on the right, no signal pill, equal CTAs.

Verdict: lock B4 as the implementation direction.

Verification evidence from the prototype lock:

- Default dev route `/prototype/session-summary` renders B4.
- Explicit route `/prototype/session-summary?variant=B4` renders B4.
- Browser visual check confirmed:
  - B4 is default;
  - left A-style completion top is present;
  - no strong-signal pill is present;
  - both closing CTAs are equal-sized and readable.
- `TMPDIR=/var/tmp npm run validate:ci` passed:
  - format;
  - Svelte check with 0 errors and 0 warnings;
  - lint;
  - 51 test files / 407 tests;
  - build.

## Constraints and non-goals

- This is a product/design direction brief, not the implementation plan.
- The prototype route is a development artifact, not production UI.
- Do not import prototype chrome, variant switchers, or comparison scaffolding into production.
- Preserve Japanese Learner’s travel-readiness focus and warm washi visual language.
- Preserve immediate exercise feedback in the exercise flow; the summary should not duplicate it.

## What later builders may decide

- Exact production component decomposition.
- Whether the useful unlock is sourced from `summary.miniLesson`, a new summary field, or a normalized view model adapter.
- Exact responsive behavior and spacing once implemented in production components.
- Whether old strengths/weaknesses are removed from the UI entirely or kept as hidden/internal data for tutor memory.

## What later builders must not decide

- Reintroducing the backward-looking strengths/weaknesses grid as the default summary frame.
- Reintroducing the strong-signal pill.
- Making “Try Practice Mode” visually larger than “Return Home.”
- Turning the close-session area into another drill or quiz.
- Treating the prototype route as production code without translating it into the app’s real component/data model.

## Remaining decisions that require Tuukka

- Whether production implementation should happen immediately or stay as a locked prototype for now.
- Whether the old AI summary prompt should be changed at the same time as the UI, or whether production should first adapt existing fields into the new layout.

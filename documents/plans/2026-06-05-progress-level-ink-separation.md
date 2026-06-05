# Separate Learning Level and Ink Progress Implementation Plan

> **For Hermes:** Use `subagent-driven-development` if implementing this plan with subagents. Keep each task narrow, verify after each slice, and do not expand the feature beyond separating learning level from ink/XP.

**Date:** 2026-06-05

**Status:** active

**Owner/Agent:** Alfred / Hermes

## Goal

Remove the misleading coupling between learning level and ink/XP on the `/progress` page so profile/tutor level and ink-based gamification are presented as separate systems.

## Architecture

The current feature branch builds `/progress` analytics mostly through `src/routes/progress/progress-view-model.ts`, then renders the prepared view models in `src/routes/progress/+page.svelte`. The fix should keep that structure, but make `buildLevelJourney` profile-level-only and move all ink/XP threshold language to ink history and milestone sections. Database and gamification internals can continue using the existing `user_xp` and `GamificationStats` names; user-facing copy should prefer “ink” where the feature means 墨.

## Tech Stack

- SvelteKit 2
- Svelte 5 runes
- TypeScript strict mode
- Vitest
- Existing `/progress` streamed load data from `src/routes/progress/+page.server.ts`

## Assumptions

- `users.level` is the source of truth for learning/profile/tutor level.
- Ink/XP is a separate activity and rewards currency stored in `user_xp` and surfaced through `gamification.totalXp`.
- Ink milestones remain threshold-based and can keep using `MILESTONES` from `src/lib/server/gamification.ts`.
- Learning level changes only through existing tutor recommendation / profile update flows, currently represented by the session summary level-up recommendation and `/api/user/level`.

## Scope

- Decouple the Level Journey view model from total ink/XP, daily XP history, hardcoded XP thresholds, pace, and “ink to go”.
- Rename user-facing “XP History” language to “Ink History” where it refers to 墨 earned.
- Rename the level section to “Learning Level Journey” or otherwise make clear it is profile/tutor level, not ink progress.
- Update tests to lock the separation down.
- Update progress planning docs so future agents do not reintroduce XP-based levels from stale roadmap language.

## Non-goals

- Do not change the `user_xp` database table or existing gamification transaction logic.
- Do not change how session completion awards ink/XP.
- Do not change `/api/user/level` behavior.
- Do not add automatic level promotion from ink totals.
- Do not add new charts, filters, persistence tables, or level history tables in this cleanup.
- Do not redesign the whole `/progress` page.

## Affected files

| Path                                              | Expected change                                                                                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/progress/progress-view-model.ts`      | Modify level journey types and builder so they use only `currentLevel`; remove XP thresholds, pace, and `xpToNext` from the level journey model. Optionally rename `buildLevelJourney` to `buildLearningLevelJourney` for clarity. |
| `src/routes/progress/progress-view-model.test.ts` | Modify tests to assert learning level is profile-level-only and ink values do not affect it. Keep existing ink history, calendar, milestone, skill, and history tests.                                                             |
| `src/routes/progress/+page.svelte`                | Modify labels/copy/rendering: Ink History for XP chart, Learning Level Journey for profile levels, no ink threshold/progress bar/pace in level section, clearer “next ink milestone” labels in summary.                            |
| `documents/plans/progress-page-roadmap.md`        | Modify roadmap wording for Level Journey and milestones so learning level is not described as XP-threshold progression.                                                                                                            |
| `documents/INDEX.md`                              | Add this active plan to the index if not already present.                                                                                                                                                                          |

## Implementation tasks

### Task 1: Rewrite the level journey tests first

**Objective:** Lock the intended product boundary before editing implementation.

**Files:**

- Modify: `src/routes/progress/progress-view-model.test.ts`

**Step 1: Replace the XP-threshold level journey test**

Replace the current test named similar to:

```ts
it('builds a level journey with current level, thresholds, pace, and XP to next level', () => {
  // current XP-threshold expectations
});
```

with profile-level-only expectations:

```ts
it('builds a learning level journey from the stored profile level only', () => {
  const journey = buildLearningLevelJourney({ currentLevel: 'elementary' });

  expect(journey.currentLevel).toBe(3);
  expect(journey.currentLevelLabel).toBe('Elementary');
  expect(journey.steps).toHaveLength(8);
  expect(journey.steps[2]).toMatchObject({
    level: 3,
    label: 'Elementary',
    isCurrent: true,
    isReached: true,
    isNext: false,
  });
  expect(journey.nextLevel).toMatchObject({
    level: 4,
    label: 'Pre-Intermediate',
    isNext: true,
  });
  expect(journey.isMaxLevel).toBe(false);
  expect(journey).not.toHaveProperty('xpToNext');
  expect(journey).not.toHaveProperty('progressToNextPct');
  expect(journey).not.toHaveProperty('estimatedDaysToNext');
});
```

If the implementation keeps the existing function name instead of renaming it, use `buildLevelJourney` in the test. Prefer the rename because the old name has already carried confusing semantics.

**Step 2: Replace the “does not derive from XP” test with an API-boundary test**

Remove `totalXp` from the test input entirely. Use the absence of XP fields as the contract:

```ts
it('does not expose ink or XP requirements for learning level progression', () => {
  const journey = buildLearningLevelJourney({ currentLevel: 'beginner' });

  expect(journey.currentLevel).toBe(2);
  expect(journey.currentLevelLabel).toBe('Beginner');
  expect(journey.nextLevel).toMatchObject({ level: 3, label: 'Elementary' });
  for (const step of journey.steps) {
    expect(step).not.toHaveProperty('thresholdXp');
  }
});
```

**Step 3: Keep max-level coverage**

Update the max-level test to remove XP and pace expectations:

```ts
it('builds max learning level state explicitly', () => {
  const journey = buildLearningLevelJourney({ currentLevel: 'ready_for_japan' });

  expect(journey.currentLevel).toBe(8);
  expect(journey.currentLevelLabel).toBe('Ready for Japan 🇯🇵');
  expect(journey.nextLevel).toBeNull();
  expect(journey.isMaxLevel).toBe(true);
});
```

**Step 4: Run the focused test and verify the expected failure**

Run:

```bash
npm test -- src/routes/progress/progress-view-model.test.ts --run
```

Expected before implementation: FAIL because `buildLearningLevelJourney` does not exist yet, or because old XP fields are still present.

### Task 2: Make the level journey view model profile-level-only

**Objective:** Remove ink/XP from the Level Journey model.

**Files:**

- Modify: `src/routes/progress/progress-view-model.ts`

**Step 1: Rename and narrow the level journey types**

Replace the current level journey interfaces with this shape:

```ts
export interface LearningLevelJourneyInput {
  currentLevel: string | number;
}

export interface LearningLevelJourneyStep {
  level: number;
  label: string;
  isCurrent: boolean;
  isReached: boolean;
  isNext: boolean;
}

export interface LearningLevelJourneyViewModel {
  currentLevel: number | null;
  currentLevelLabel: string;
  steps: LearningLevelJourneyStep[];
  nextLevel: LearningLevelJourneyStep | null;
  isMaxLevel: boolean;
}
```

Delete these XP-specific fields from the level journey model:

- `totalXp`
- `thresholdXp`
- `xpToNext`
- `progressToNextPct`
- `recentAverageDailyXp`
- `recentWeeklyPaceXp`
- `estimatedDaysToNext`
- `hasPaceData`

**Step 2: Remove `LEVEL_THRESHOLDS`**

Delete:

```ts
const LEVEL_THRESHOLDS = [0, 100, 300, 700, 1500, 3000, 6000, 10000] as const;
```

Learning levels are not earned from ink totals.

**Step 3: Implement the narrowed builder**

Use the existing `LEVEL_ORDER` and `LEVEL_LABELS` mapping:

```ts
export function buildLearningLevelJourney(
  input: LearningLevelJourneyInput,
): LearningLevelJourneyViewModel {
  const levelFromUser = parseLevel(input.currentLevel);
  const clampedCurrentLevel = Math.max(1, Math.min(LEVEL_NAMES.length, levelFromUser ?? 1));
  const nextLevelNumber = clampedCurrentLevel < LEVEL_NAMES.length ? clampedCurrentLevel + 1 : null;

  const steps = LEVEL_NAMES.map(({ level, label }) => ({
    level,
    label,
    isCurrent: level === clampedCurrentLevel,
    isReached: level <= clampedCurrentLevel,
    isNext: level === nextLevelNumber,
  }));

  const nextLevel = nextLevelNumber ? (steps[nextLevelNumber - 1] ?? null) : null;

  return {
    currentLevel: clampedCurrentLevel,
    currentLevelLabel: getLevelLabel(clampedCurrentLevel),
    steps,
    nextLevel,
    isMaxLevel: nextLevel === null,
  };
}
```

Keep `parseLevel` and `getLevelLabel` unless TypeScript shows they can be simplified safely.

**Step 4: Run the focused test**

Run:

```bash
npm test -- src/routes/progress/progress-view-model.test.ts --run
```

Expected: PASS for view-model tests, or only failures pointing at the Svelte page import still using the old function name.

### Task 3: Update `/progress` UI copy and rendering

**Objective:** Present ink and learning level as separate systems in the actual page.

**Files:**

- Modify: `src/routes/progress/+page.svelte`

**Step 1: Update imports and local constants**

Replace the level journey import:

```ts
buildLevelJourney,
```

with:

```ts
buildLearningLevelJourney,
```

Replace the local constant:

```svelte
{@const levelJourney = buildLevelJourney({
  totalXp: gamification.totalXp,
  currentLevel: userLevel,
  dailyXpHistory: resolved.dailyXpHistory,
})}
```

with:

```svelte
{@const levelJourney = buildLearningLevelJourney({ currentLevel: userLevel })}
```

**Step 2: Change user-facing XP history labels to ink labels**

Change visible labels and ARIA copy where the section means 墨 earned:

- `XP History` -> `Ink History`
- `Daily XP totals for the last 30 days` -> `Daily ink totals for the last 30 days`
- `Daily totals from current XP rollups, not an event ledger.` -> `Daily ink totals from current reward rollups.`

Do not rename `dailyXpHistory` unless doing so stays local and low-risk. The backend and gamification internals still use XP naming.

**Step 3: Make summary labels explicit**

In Header Summary, change:

- `Current level` -> `Learning level`
- `Total ink` stays as-is
- `Next milestone` -> `Next ink milestone`

The value `gamification.xpToNextMilestone` can still render as “墨 to go” because this is an ink milestone, not a learning level.

**Step 4: Replace Level Journey section language**

Change the section heading to:

```svelte
<h2 id="level-heading">Learning Level Journey</h2>
```

Replace the copy with:

```svelte
<p class="section-copy">Separate from ink. This reflects your current tutor/profile level.</p>
```

Change the right-hand stats from `levelJourney.totalXp` to next-level context only:

```svelte
<div class="streak-stats">
  <span>Current: <strong>{levelJourney.currentLevelLabel}</strong></span>
  {#if levelJourney.nextLevel}
    <span class="separator">·</span>
    <span>Next: <strong>{levelJourney.nextLevel.label}</strong></span>
  {/if}
</div>
```

**Step 5: Remove threshold text from each level step**

Replace the level step title and small text so they no longer mention ink thresholds:

```svelte
<div
  class="level-step"
  class:reached={step.isReached}
  class:current={step.isCurrent}
  class:next={step.isNext}
  title={step.label}
>
  <span>{step.level}</span>
  <small>{step.isCurrent ? 'Current' : step.isNext ? 'Next' : ''}</small>
</div>
```

If empty `<small>` creates awkward layout, use a visually stable non-breaking space or CSS rule rather than reintroducing threshold numbers.

**Step 6: Replace level details**

Replace the old `Next: ... at ... 墨`, `... 墨 to go`, progress meter, and recent pace block with:

```svelte
<div class="level-details">
  {#if levelJourney.isMaxLevel}
    <strong>Highest learning level selected.</strong>
    <span>Keep practicing to deepen readiness.</span>
  {:else if levelJourney.nextLevel}
    <strong>Next learning level: {levelJourney.nextLevel.label}</strong>
    <span>Learning level changes through tutor recommendations, not ink totals.</span>
  {/if}
</div>
```

**Step 7: Run focused validation**

Run:

```bash
npm test -- src/routes/progress/progress-view-model.test.ts --run
npm run check
```

Expected: both pass.

### Task 4: Update progress roadmap language

**Objective:** Remove stale planning language that says level journey is XP-threshold based.

**Files:**

- Modify: `documents/plans/progress-page-roadmap.md`

**Step 1: Update information architecture wording**

Where the roadmap groups “XP + levels”, make it explicit that ink momentum and learning level are separate.

Suggested replacement for the rationale line:

```md
Rationale: start with macro trajectory by showing ink momentum and profile learning level separately, then achievements/consistency, then detailed performance diagnostics.
```

**Step 2: Update Milestone Gallery categories**

Replace `XP/level` category wording with:

```md
- ink/XP milestones
```

Do not imply learning levels unlock from ink milestones.

**Step 3: Rewrite Level Journey scope**

Replace the Level Journey “What it contains” bullets with:

```md
- Visual progression across all **8 user learning levels**
- Current profile/tutor level from `users.level`
- Next learning level label, without ink/XP requirements
- Clear copy that learning level changes through tutor recommendations/profile updates, not ink totals
```

Replace the technical considerations with:

```md
- Treat `users.level` and ink/XP totals as separate systems.
- Do not derive learning level from `user_xp` totals.
- If persisted level-up event history is added later, model it as tutor/profile level history, not XP threshold history.
```

**Step 4: Update the UI sketch**

Remove `(7,450 墨)`, `Next: ... at ... 墨`, and recent pace language from the Level Journey sketch. Use:

```text
Current: Pre-Intermediate
Next learning level: Intermediate
Level changes through tutor recommendations, not ink totals.
```

### Task 5: Final validation and handoff

**Objective:** Verify the cleanup and record exact results.

**Files:**

- No additional source changes expected unless validation finds issues.

**Step 1: Run focused tests**

Run:

```bash
npm test -- src/routes/progress/progress-view-model.test.ts --run
```

Expected: all tests in `progress-view-model.test.ts` pass.

**Step 2: Run formatting check**

Run:

```bash
npm run format:check
```

Expected: pass. If it fails only due to touched files, run `npm run format` and re-check.

**Step 3: Run full CI gate**

Run:

```bash
npm run validate:ci
```

Expected: pass.

**Step 4: Review the diff for forbidden coupling**

Run:

```bash
git diff -- src/routes/progress/progress-view-model.ts src/routes/progress/+page.svelte src/routes/progress/progress-view-model.test.ts documents/plans/progress-page-roadmap.md
```

Check manually:

- No Level Journey copy mentions ink, XP, thresholds, pace, or “to go”.
- No `buildLearningLevelJourney` input includes `totalXp` or `dailyXpHistory`.
- Ink milestone copy still uses “墨 to go” only for milestones.
- Ink History still shows the last 30 days.

**Step 5: Commit if implementing on this feature branch**

If the implementation is being committed, use a focused commit:

```bash
git add src/routes/progress/progress-view-model.ts src/routes/progress/progress-view-model.test.ts src/routes/progress/+page.svelte documents/plans/progress-page-roadmap.md

git commit -m "fix: separate learning level from ink progress"
```

## Acceptance criteria

- `/progress` no longer shows “0 墨 to go” or any ink/XP threshold inside Level Journey.
- Level Journey current state is based on `users.level` only.
- Level Journey labels make clear it is learning/profile/tutor level, separate from ink.
- Ink History still shows daily ink totals for the last 30 days, including zero-activity days.
- Header Summary distinguishes `Learning level`, `Total ink`, and `Next ink milestone`.
- Milestone Gallery can still show ink progress toward milestone thresholds.
- Tests prevent reintroducing XP-derived learning level behavior.
- Full `npm run validate:ci` passes.

## Risks / open questions

- The existing database query for daily XP uses `date('now', ...)`, while the app otherwise cares about Helsinki-local dates. This plan does not fix that timezone issue; it should be handled separately if it causes boundary-day chart errors.
- Existing internal names still use `XP` while user-facing copy says “ink”. That is acceptable for now because the DB and gamification code already use XP terminology. A broad internal rename would be churn, not value.
- The app currently has no persisted learning-level history. This plan should not fake one.

## Handoff checklist

- [ ] Scope stayed within separating learning level from ink/XP.
- [ ] Files changed are listed in the handoff.
- [ ] Behavior changed is marked yes and explained.
- [ ] Focused progress view-model tests passed with exact command output.
- [ ] `npm run format:check` passed or touched files were formatted and re-checked.
- [ ] `npm run validate:ci` passed.
- [ ] Risks and follow-ups are recorded, especially the separate timezone concern.

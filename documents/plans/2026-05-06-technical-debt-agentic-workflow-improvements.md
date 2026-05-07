# Technical Debt and Agentic Workflow Improvements Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task. Use a fresh implementation subagent per task or lane, then run spec-compliance and code-quality review before moving on.

**Date:** 2026-05-06

**Status:** Partially implemented — first implementation batch completed in commit `2e7b507`; second docs/workflow batch completed in commit `docs: document agent workflow templates and index`; third reproducibility/env batch completed in commit `chore: pin runtime and sync env config`; Node 24 runtime follow-up completed in commit `chore: upgrade pinned runtime to node 24`.

**Goal:** Reduce maintenance risk and make future AI-agent work safer, faster, and more reproducible without adding user-facing learning features.

**Architecture:** Treat this as a sequence of small internal hardening passes: documentation/workflow first, then tooling enforcement, then shared validation/helper boundaries, then gradual decomposition of the largest server/UI modules. Preserve current behavior and public app flows.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Vitest, ESLint, Prettier, Turso/libsql, OpenAI, Vercel.

---

## 1. Scope

This plan covers internal improvements only:

- agent/workflow documentation
- CI and validation gates
- dependency vulnerability remediation
- stale docs cleanup
- env/toolchain hygiene
- ignore/prettier hygiene
- shared runtime validators
- shared request/response/helper utilities
- DB module decomposition
- AI module decomposition
- targeted tests around risky internal boundaries
- structured logging/background task helpers
- gradual Svelte page/component state extraction

## 2. Non-goals

Do **not** add or redesign product features while executing this plan.

Explicitly out of scope:

- new learning modes
- new missions or exercise types
- new gamification mechanics
- visual redesigns
- new public portfolio behavior
- scaling/multi-tenant auth architecture
- changing OpenAI prompt behavior unless required to preserve existing tests during refactor
- changing database semantics unless the task explicitly says to normalize an existing migration/schema concern

If an implementer notices feature ideas, put them in a short “parking lot” note in the final handoff, not in code.

---

## 3. Current verified context

Repository root:

```bash
/Users/tuukka.ylostalo/Projects/japanese-learner
```

Current validation, verified before this plan was written:

```bash
npm run validate
# passed: svelte-check 0 errors/warnings, eslint clean, vitest 70 tests / 10 files passed

npm run build
# passed; Vercel adapter emitted existing non-blocking optional dependency warnings
```

Current git status before plan creation:

```bash
## master...origin/master
?? .idea/
```

Core project mission:

- Personal Japanese travel-readiness tutor app for the owner and a few friends.
- Not a scalable SaaS product.
- Main app flows: profile selection, AI learn sessions, practice sessions, progress dashboard, missions, TTS, portfolio challenge.

Important current files:

- `README.md`
- `documents/CONTRIBUTING.md`
- `package.json`
- `.env.example`
- `.gitignore`
- `.prettierignore`
- `.npmrc`
- `vite.config.ts`
- `src/lib/types.ts`
- `src/lib/config.ts`
- `src/lib/server/config.ts`
- `src/lib/server/db.ts`
- `src/lib/server/ai.ts`
- `src/lib/server/gamification.ts`
- `src/lib/server/missions-db.ts`
- `src/lib/server/missions-ai.ts`
- `src/lib/server/token-limiter.ts`
- `src/routes/api/**/+server.ts`
- largest Svelte pages/components under `src/routes/**/+page.svelte` and `src/lib/components/**`

Largest maintainability risks found in the audit:

- `src/lib/server/ai.ts`: 1718 lines
- `src/lib/server/db.ts`: 1370 lines
- `src/routes/portfolio/challenge/+page.svelte`: 1016 lines
- `src/lib/components/SessionSummary.svelte`: 883 lines
- `src/routes/missions/[id]/+page.svelte`: 849 lines
- `src/lib/server/portfolio-challenge.ts`: 779 lines
- `src/routes/progress/+page.svelte`: 757 lines
- `src/lib/server/gamification.ts`: 749 lines
- `src/routes/learn/+page.svelte`: 733 lines

---

## 3.1 Implementation progress

### Completed first implementation batch

**Completed on:** 2026-05-06

**Commit:** `2e7b507` (`chore: harden agent workflow and validation`)

**Validation:** `npm run validate:ci` passed after the batch: formatting, Svelte check, ESLint, Vitest (`82` tests), and production build all passed. Existing Vercel optional dependency warnings were unchanged.

**Review status:** independent spec-compliance review passed, and independent code-quality/security review approved.

Completed tasks:

- [x] Task 0.1 — Confirmed baseline before editing.
- [x] Task 3.4 — Ignored `.idea/` and aligned `.prettierignore` with generated/editor artifacts.
- [x] Task 1.1 — Added root `AGENTS.md` with boot, validation, coding, and subagent guidance.
- [x] Task 2.1 — Added `npm run validate:ci` and aligned README/CONTRIBUTING/AGENTS guidance.
- [x] Task 2.2 — Added `.github/workflows/ci.yml` to run `npm ci` and `npm run validate:ci`.
- [x] Task 3.1 — Fixed README drift for current routes, API groups, cookie name, and DB summary.
- [x] Task 4.2 — Centralized `SessionMeta` parsing in `src/lib/validators/session-meta.ts` and updated `db.ts` plus `api/session/generate` to use it.
- [x] Task 4.3 — Centralized `calculateMaxCombo` in `src/lib/utils/results.ts` and updated session/practice completion routes to use it.

### Completed second docs/workflow batch

**Completed on:** 2026-05-06

**Commit:** `docs: document agent workflow templates and index`

**Validation:** `npm run format:check` passed after the batch.

**Review status:** independent spec-compliance review passed after one index-ordering fix, and independent code-quality/security review approved after replacing unsafe raw-AI-response logging guidance with sanitized logging guidance.

Completed tasks:

- [x] Task 1.2 — Added agent boot sequence, subagent lanes, review gates, and maintenance/refactor non-goals to `documents/CONTRIBUTING.md`.
- [x] Task 1.3 — Added reusable plan/decision/review templates under `documents/templates/` and linked them from `documents/CONTRIBUTING.md`.
- [x] Task 3.2 — Added `documents/INDEX.md` with status labels for current docs and linked it from `README.md`.

### Completed third reproducibility/env batch

**Completed on:** 2026-05-07

**Commit:** `chore: pin runtime and sync env config`

**Validation:** `npm install --package-lock-only` and `npm run validate:ci` passed after the batch. Validation included formatting, Svelte check, ESLint, Vitest (`82` tests), and production build. Existing Vercel optional dependency warnings were unchanged.

**Review status:** independent spec-compliance review passed, and independent code-quality/security review approved. One minor reviewer suggestion to harden `AUTH_SECRET` documentation was addressed before commit.

Completed tasks:

- [x] Task 2.3 — Added Node/npm runtime expectations: `package.json` `engines.node`, `packageManager`, `.nvmrc`, README setup guidance, package-lock metadata, and CI `node-version-file: .nvmrc`.
- [x] Task 3.3 — Synchronized env documentation and parsing for `AUTH_SECRET`, `MISSIONS_UNLOCK_ALL`, `SESSION_GENERATION_TIMEOUT_MS`, OpenAI TTS availability, and deprecated/unused `MONTHLY_TOKEN_BUDGET`.

### Completed Node 24 runtime follow-up

**Completed on:** 2026-05-07

**Commit:** `chore: upgrade pinned runtime to node 24`

**Validation:** Node `v24.15.0` with npm `11.12.1`; `npm install --package-lock-only`, `npm ci`, and `npm run validate:ci` passed after the update. Existing Vercel optional dependency warnings were unchanged.

**Review status:** Node 24 compatibility was checked against Vercel Node runtime documentation and package engine ranges before changing the pin.

Completed follow-up:

- [x] Updated Task 2.3 runtime pin from Node 22 to Node 24 after confirming no project-specific reason to stay on Node 22.

### Completed current helper extraction batch

**Completed on:** 2026-05-07

**Commit:** `chore: centralize timeout helper and track audits`

**Validation:** `npm test -- src/lib/server/async.test.ts src/routes/api/session/generate.server.test.ts src/lib/server/ai.public-challenge.test.ts` passed, `npm run validate` passed with Vitest `85` tests / `13` files, and `npm run validate:ci` passed including format/build. Existing Vercel optional dependency warnings were unchanged.

**Review status:** independent spec-compliance review passed, and independent code-quality/security review approved.

Completed tasks:

- [x] Task 4.4 — Centralized abort/timeout wrapping in `src/lib/server/async.ts` and replaced duplicated helpers in session generation plus portfolio challenge.

### Next recommended starting point

Do not redo the completed first/docs/reproducibility batches unless a regression is discovered. A new agent should start from one of these unfinished lanes:

1. Audit and fix dependency vulnerabilities: Task 2.4.
2. Continue low-risk helper extraction: Task 4.5.
3. Start targeted pure/request-boundary tests: Task 5.1, Task 5.2, Task 5.3.
4. Continue staged decomposition only after helper/test boundaries are in place: DB internals (Phase 6), then AI internals (Phase 7).

Still incomplete from the whole plan: dependency vulnerability remediation, API/background helpers, targeted route/gamification/auth tests, DB decomposition, AI decomposition, API/profile hardening, background task boundary, Svelte modularization, and final documentation closure.

---

## 4. Implementation principles

1. Preserve behavior unless a task explicitly says otherwise.
2. Prefer small pull requests / commits over a single large refactor.
3. Keep public imports stable while decomposing internals. For example, `src/lib/server/ai.ts` and `src/lib/server/db.ts` may initially become barrel/facade modules that re-export extracted functions.
4. Add or move tests before changing risky internals where possible.
5. Do not let multiple agents edit the same large file at the same time.
6. For every code-changing task, run the narrowest relevant test first, then the full gate at phase end.
7. Update docs in the same task that changes the workflow or architecture they describe.
8. Any task touching prompts, AI output parsing, DB migrations, auth/profile scoping, or background writes needs independent review before merge.

---

## 5. Recommended agent orchestration

### 5.1 Suggested lanes

Use these lanes if implementing in parallel. Do not overlap files across lanes without an integration captain.

| Lane | Ownership                 | Typical files                                                                                                |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A    | Docs and agent workflow   | `AGENTS.md`, `documents/CONTRIBUTING.md`, `documents/templates/*`, `documents/INDEX.md`, `README.md`         |
| B    | Tooling and CI            | `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.npmrc`, `.nvmrc`, `.env.example`, ignores |
| C    | Shared validators/helpers | `src/lib/validators/**`, `src/lib/utils/**`, `src/lib/server/request*.ts`, related tests                     |
| D    | DB internals              | `src/lib/server/db.ts`, `src/lib/server/db-*.ts`, `src/lib/server/repositories/**`, DB tests                 |
| E    | AI internals              | `src/lib/server/ai.ts`, `src/lib/server/ai-*.ts`, `src/lib/server/ai/**`, AI tests                           |
| F    | API/profile boundaries    | `src/routes/api/**/+server.ts`, `src/lib/server/api*.ts`, route tests                                        |
| G    | UI modularization         | large `.svelte` pages/components and extracted page-state modules                                            |

### 5.2 Required subagent handoff format

Each subagent must return:

```text
Task:
Files changed:
Behavior changed: yes/no. If yes, explain.
Tests run:
Validation result:
Risks / follow-ups:
```

### 5.3 Required review gates

For each task or lane:

1. **Spec compliance review**
   - Does the implementation match this plan?
   - Did it avoid feature creep?
   - Are file paths and scope correct?

2. **Code quality review**
   - Is the code simpler than before?
   - Are tests adequate for changed behavior?
   - Are names and boundaries clear?
   - Are secrets/user content protected in logs?

3. **Phase verification**
   - Run the commands listed in the phase.
   - Record exact results in the final handoff.

---

## 6. Phase 0 — Baseline and working agreement

### Task 0.1: Confirm baseline before editing

**Objective:** Ensure the implementer starts from a known state.

**Files:** none.

**Steps:**

1. Run:

   ```bash
   git status --short --branch
   npm run validate
   npm run build
   ```

2. Expected:
   - `npm run validate` passes.
   - `npm run build` passes.
   - Existing Vercel optional dependency warnings are acceptable if unchanged.
   - Only known pre-existing untracked `.idea/` noise may appear unless already cleaned.

3. If validation fails before any edit:
   - Stop.
   - Capture output.
   - Do not start refactors until baseline is understood.

---

## 7. Phase 1 — Agent workflow and documentation bootstrap

### Task 1.1: Add root `AGENTS.md`

**Objective:** Give future agents an auto-discoverable boot file.

**Files:**

- Create: `AGENTS.md`
- Review: `documents/CONTRIBUTING.md`
- Review: `README.md`

**Required content:**

`AGENTS.md` should be concise but complete enough for a new agent. Include:

- project mission: personal Japanese travel-readiness tutor for owner/friends
- mandatory reading:
  - `README.md`
  - `documents/CONTRIBUTING.md`
  - relevant `documents/plans/*` and `documents/decisions/*`
- boot sequence:
  1. `git status --short --branch`
  2. read current task/plan
  3. inspect relevant files/tests before editing
  4. identify validation commands before editing
  5. avoid feature drift
- coding constraints:
  - SvelteKit 2
  - Svelte 5 runes
  - TypeScript strict mode
  - server-only code belongs in `src/lib/server/`
  - use design tokens in `src/app.css`
- validation commands:
  - `npm run validate`
  - `npm run build`
  - later update this after `validate:ci` exists
- subagent workflow summary:
  - independent lanes
  - no overlapping edits to large files
  - spec review then quality review
- no-feature-drift rule for maintenance/refactor tasks

**Verification:**

```bash
npm run format:check
```

If format fails because the new markdown is unformatted, run:

```bash
npm run format -- AGENTS.md
```

Then rerun `npm run format:check`.

### Task 1.2: Add workflow sections to `documents/CONTRIBUTING.md`

**Objective:** Promote agentic implementation rules from the audit into the project guide.

**Files:**

- Modify: `documents/CONTRIBUTING.md`

**Add sections:**

1. `## Agent Boot Sequence`
2. `## Agentic Work and Subagent Lanes`
3. `## Review Gates`
4. `## Maintenance / Refactor Non-Goals`

**Content requirements:**

- Reference `AGENTS.md` as the root bootstrap document.
- List the lane model from section 5.1 of this plan.
- Require handoff format from section 5.2.
- Require review gates from section 5.3.
- State: for maintenance/refactor tasks, do not add user-facing features.

**Verification:**

```bash
npm run format:check
```

### Task 1.3: Add reusable documentation templates

**Objective:** Make future plans/decisions/reviews consistent enough for agents to execute.

**Files:**

- Create: `documents/templates/plan-template.md`
- Create: `documents/templates/decision-template.md`
- Create: `documents/templates/review-template.md`
- Modify: `documents/CONTRIBUTING.md`

**Template requirements:**

`plan-template.md` must include:

- title
- date
- status
- owner/agent
- goal
- scope
- non-goals
- affected files
- implementation tasks
- acceptance criteria
- tests/validation
- risks/open questions
- handoff checklist

`decision-template.md` must include:

- decision title
- date
- status
- context
- decision
- alternatives considered
- rationale
- consequences
- follow-up tasks

`review-template.md` must include:

- reviewed task/PR/branch
- reviewer
- files reviewed
- spec-compliance checklist
- code-quality checklist
- security/privacy checklist
- tests reviewed/run
- verdict: approved/request changes
- blocking issues
- non-blocking suggestions

Update `documents/CONTRIBUTING.md` to point to these templates.

**Verification:**

```bash
npm run format:check
```

---

## 8. Phase 2 — Tooling, CI, and reproducibility

### Task 2.1: Add canonical CI validation script

**Objective:** Align README, CONTRIBUTING, agents, and CI around one full gate.

**Files:**

- Modify: `package.json`
- Update automatically if needed: `package-lock.json`
- Modify after script exists: `README.md`
- Modify after script exists: `documents/CONTRIBUTING.md`
- Modify after script exists: `AGENTS.md`

**Implementation guidance:**

Add a script named `validate:ci` that runs:

```bash
npm run format:check && npm run check && npm run lint && npm run test && npm run build
```

Keep the existing `validate` script unless there is a deliberate decision to make it identical to `validate:ci`.

**Verification:**

```bash
npm run validate:ci
```

Expected:

- format check passes
- Svelte check passes
- eslint passes
- Vitest passes
- production build passes

Existing Vercel optional dependency warnings are acceptable if unchanged.

### Task 2.2: Add GitHub Actions CI

**Objective:** Enforce the validation gate outside local/agent sessions.

**Files:**

- Create: `.github/workflows/ci.yml`

**Workflow requirements:**

- Run on pull requests.
- Run on pushes to `master` and `main` unless the repo intentionally uses only one branch.
- Use Node version from `.nvmrc` or `package.json` engines once Task 2.3 exists.
- Use `npm ci`.
- Run `npm run validate:ci`.

**Suggested workflow shape:**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master, main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm run validate:ci
```

If `.nvmrc` is not added in Task 2.3, use an explicit Node version and document it.

**Verification:**

```bash
npm run validate:ci
```

Also inspect YAML formatting manually.

### Task 2.3: Pin Node/npm expectations

**Objective:** Make local agents and CI use a reproducible runtime.

**Files:**

- Modify: `package.json`
- Create: `.nvmrc` or `.node-version`
- Modify: `README.md`
- Possibly modify: `.github/workflows/ci.yml`

**Implementation guidance:**

1. Inspect current local versions:

   ```bash
   node --version
   npm --version
   ```

2. Add `engines.node` to `package.json` using the project’s chosen supported version/range.
3. Add `packageManager` to `package.json`, matching the lockfile/npm version policy.
4. Add `.nvmrc` with the selected Node major/version.
5. Document the expected version in README setup.

**Important:** `.npmrc` currently has `engine-strict=true`, so `engines.node` must be accurate enough not to break installs.

**Verification:**

```bash
npm install --package-lock-only
npm run validate:ci
```

If `package-lock.json` changes only due to package metadata/script changes, include it in the commit.

### Task 2.4: Audit and fix dependency vulnerabilities

**Objective:** Remediate dependency advisories without introducing product changes or unnecessary breaking upgrades.

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Possibly modify: `.npmrc` if install/audit policy needs explicit documentation
- Possibly modify: README or maintenance docs if residual advisories are accepted

**Current audit context:**

`npm audit --json` currently reports 7 vulnerabilities: 1 low, 3 moderate, and 3 high. Direct vulnerable dependencies are `@sveltejs/kit` and `vite`. Transitive vulnerable dependencies are `cookie`, `brace-expansion`, `picomatch`, `postcss`, and `yaml`. All reported advisories have `fixAvailable: true`.

**Implementation guidance:**

1. Run `npm audit --json` and inspect the current advisories plus available fixed versions.
2. Prefer non-breaking package upgrades first, especially patch/minor updates to direct dependencies.
3. Avoid `npm audit fix --force` unless a human or reviewer explicitly accepts the reviewed breaking-change scope.
4. Update `package.json` and `package-lock.json` using npm so the lockfile stays reproducible.
5. If any advisories remain, document the accepted residual advisory IDs/severity, why they are accepted, and the follow-up owner/date.

**Verification:**

```bash
npm audit
npm run validate:ci
```

Expected: `npm audit` reports zero vulnerabilities. If that is not possible without an explicitly accepted breaking upgrade, document the residual advisories and their rationale before merge.

---

## 9. Phase 3 — Docs and repository hygiene

### Task 3.1: Clean up README drift

**Objective:** Make README match the current app so agents do not follow stale architecture.

**Files:**

- Modify: `README.md`

**Known drift to fix:**

- Replace `/history` references with current `/progress` route where appropriate.
- Update selected user cookie name from stale `selected_user_id` to current `selected_user` if source still uses that name.
- Remove or update stale references to:
  - `src/lib/server/seed.ts`
  - `src/lib/data/seed-exercises.json`
- Update app route list to include current major routes:
  - `/`
  - `/learn`
  - `/practice`
  - `/missions`
  - `/missions/[id]`
  - `/progress`
  - `/portfolio/challenge`
- Update API route list to include current major groups:
  - `/api/auth/*`
  - `/api/user/*`
  - `/api/session/*`
  - `/api/practice/*`
  - `/api/missions/*`
  - `/api/portfolio/session/*`
  - `/api/check-answer`
  - `/api/tts`
- Update DB table summary to include current table groups:
  - users/sessions/exercises/results/token usage
  - XP/streaks/milestones
  - missions/user missions/badges/mission limits
  - portfolio challenge attempts

**Verification:**

```bash
npm run format:check
```

### Task 3.2: Add document index and status labels

**Objective:** Help agents distinguish active docs from old plans.

**Files:**

- Create: `documents/INDEX.md`
- Optionally modify high-risk stale docs to point to the index

**Index requirements:**

For each doc under `documents/` and `docs/superpowers/specs/`, list:

- path
- status: active / implemented / superseded / planning / analysis / decision
- short description
- source files affected, if known
- last verified against code, if known

Start with the docs most likely to mislead agents:

- `README.md` should point to `documents/INDEX.md` if the index is useful.
- `documents/portfolio-challenge-capsule.md`
- `documents/public-challenge-v2.md`
- `documents/plans/ai-session-guidelines.md`
- `documents/plans/inline-audio-tts.md`
- `documents/plans/progress-page-roadmap.md`

**Verification:**

```bash
npm run format:check
```

### Task 3.3: Synchronize env documentation and parsing

**Objective:** Make runtime configuration discoverable and avoid silent env drift.

**Files:**

- Modify: `.env.example`
- Modify if needed: `src/lib/config.ts`
- Modify if needed: `src/lib/server/config.ts`
- Modify if needed: `src/routes/+layout.server.ts`
- Modify if needed: `src/routes/api/session/generate/+server.ts`
- Modify: `README.md`

**Known source-used env vars to document:**

- `AUTH_SECRET`
- `MISSIONS_UNLOCK_ALL`
- `SESSION_GENERATION_TIMEOUT_MS`

**Known env var to verify:**

- `.env.example` includes `MONTHLY_TOKEN_BUDGET`; confirm whether it is still used. If unused, either remove it or mark it deprecated/commented with rationale.

**Implementation guidance:**

- Prefer central parsing in `src/lib/config.ts` / `src/lib/server/config.ts`.
- Avoid direct `process.env` or `env` reads inside random route files when the value belongs in config.
- Keep defaults visible and documented.

**Tests:**

Add or update tests only if config parsing becomes more complex. Otherwise validation is enough.

**Verification:**

```bash
npm run check
npm run lint
npm run test
```

### Task 3.4: Clean editor/generated-file ignore rules

**Objective:** Remove noisy untracked files from agent status checks.

**Files:**

- Modify: `.gitignore`
- Modify: `.prettierignore`

**Implementation guidance:**

Decide whether JetBrains project settings are intentionally committed.

Default recommendation for this repo:

- Add `.idea/` to `.gitignore` unless the owner wants JetBrains settings tracked.
- Align `.prettierignore` with generated/build/editor artifacts:
  - `node_modules`
  - `.svelte-kit`
  - `build`
  - `dist`
  - `.vercel`
  - `.idea`
  - possibly `.gstack`

**Verification:**

```bash
git status --short --branch
npm run format:check
```

Expected:

- `.idea/` no longer appears if ignored.

---

## 10. Phase 4 — Shared validators and small helper extraction

This phase should happen before splitting `db.ts` and `ai.ts`, because it creates stable internal boundaries.

### Task 4.1: Add shared validation module structure

**Objective:** Create a place for runtime validators without changing behavior yet.

**Files:**

- Create directory: `src/lib/validators/`
- Create: `src/lib/validators/common.ts`
- Create: `src/lib/validators/session-meta.ts`
- Create: `src/lib/validators/exercise.ts`
- Create: `src/lib/validators/storage.ts`
- Create: `src/lib/validators/api.ts`
- Create tests as needed, for example:
  - `src/lib/validators/session-meta.test.ts`
  - `src/lib/validators/exercise.test.ts`

**Implementation guidance:**

- Keep validators dependency-light so they can be used by server and browser code.
- Do not import from `src/lib/server/*` inside validators.
- Prefer functions that return discriminated results instead of throwing everywhere:

```ts
type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };
```

- Start with small helpers:
  - `asStringArray(value: unknown): string[]`
  - `asNonEmptyString(value: unknown): string | null`
  - `parseJsonObject(value: string): Record<string, unknown> | null`

**Verification:**

```bash
npm test -- src/lib/validators
npm run check
npm run lint
```

### Task 4.2: Centralize `SessionMeta` parsing

**Objective:** Remove duplicated parsing from `db.ts` and `api/session/generate`.

**Files:**

- Modify: `src/lib/validators/session-meta.ts`
- Modify: `src/lib/server/db.ts`
- Modify: `src/routes/api/session/generate/+server.ts`
- Add/modify: `src/lib/validators/session-meta.test.ts`

**Current duplication:**

- `src/lib/server/db.ts` has `parseSessionMetaSummary(...)`.
- `src/routes/api/session/generate/+server.ts` has `parseSessionMeta(...)` and duplicate mini-lesson parsing.

**Implementation guidance:**

- Move shared logic into `parseSessionMeta(value: string | null | undefined): SessionMeta | null`.
- Preserve legacy fallback behavior in `api/session/generate` for plain string summaries.
- Do not change the persisted JSON shape.

**Tests:**

Test at least:

- valid full `SessionMeta`
- missing required fields returns null
- malformed JSON returns null
- `miniLesson` null is preserved
- invalid `miniLesson` becomes undefined/null according to current behavior
- `nextSteps` and `handoffNotes` handling matches current behavior

**Verification:**

```bash
npm test -- src/lib/validators/session-meta.test.ts src/routes/api/session/generate.server.test.ts src/lib/server/ai.session-summary.test.ts
npm run validate
```

### Task 4.3: Centralize combo/result helpers

**Objective:** Remove duplicated session result utility logic.

**Files:**

- Create: `src/lib/utils/results.ts`
- Create: `src/lib/utils/results.test.ts`
- Modify: `src/routes/api/session/complete/+server.ts`
- Modify: `src/routes/api/practice/complete/+server.ts`

**Current duplication:**

- `calculateMaxCombo(...)` exists in both session completion and practice completion routes.

**Implementation guidance:**

- Extract a pure `calculateMaxCombo(results)` helper.
- Keep the input type minimal, e.g. objects with `isCorrect: boolean`.
- Replace both duplicated functions with imports.

**Tests:**

Cover:

- empty result list => 0
- all incorrect => 0
- all correct => length
- mixed sequence returns longest streak
- starts/ends with correct answers

**Verification:**

```bash
npm test -- src/lib/utils/results.test.ts
npm test -- src/lib/server/gamification.test.ts 2>/dev/null || true
npm run validate
```

If `gamification.test.ts` does not exist yet, do not treat that command as required.

### Task 4.4: Centralize timeout helper

**Objective:** Remove duplicated abort/timeout wrapper code.

**Files:**

- Create: `src/lib/server/async.ts`
- Create: `src/lib/server/async.test.ts`
- Modify: `src/routes/api/session/generate/+server.ts`
- Modify: `src/lib/server/portfolio-challenge.ts`

**Current duplication:**

- `waitForAbort` / `withAbort` exists in session generation route and portfolio challenge server module.

**Implementation guidance:**

- Export `withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T>`.
- Preserve current `Error('timeout')` behavior unless tests explicitly document a better error type.

**Tests:**

- resolves when promise resolves first
- rejects with timeout error when signal aborts first
- rejects immediately if signal already aborted

**Verification:**

```bash
npm test -- src/lib/server/async.test.ts
npm run validate
```

### Task 4.5: Add shared API request/response helpers

**Objective:** Reduce route-level casts and inconsistent JSON responses.

**Files:**

- Create: `src/lib/server/api.ts`
- Add tests if helper logic is non-trivial: `src/lib/server/api.test.ts`
- Do not migrate every route in this task unless small and safe.

**Implementation guidance:**

Start minimal:

- `readJsonBody(request): Promise<unknown>` with invalid-body handling support.
- `jsonError(message, status, extra?)` wrapper.
- `requireStringField(body, fieldName)` or equivalent.

Do not overbuild a framework. The first goal is consistency for future route migrations.

**Verification:**

```bash
npm test -- src/lib/server/api.test.ts 2>/dev/null || true
npm run check
npm run lint
```

---

## 11. Phase 5 — Targeted test coverage for risky internals

### Task 5.1: Add gamification pure-logic tests

**Objective:** Protect XP/streak/milestone behavior before refactors.

**Files:**

- Modify or create: `src/lib/server/gamification.test.ts`
- Modify production code only if needed to expose pure helpers safely.

**Implementation guidance:**

- Prefer testing pure functions without Turso/network dependency.
- If needed, extract pure calculations from `src/lib/server/gamification.ts` into:
  - `src/lib/server/gamification-rules.ts`
  - `src/lib/server/gamification-rules.test.ts`
- Keep existing exported behavior stable.

**Test cases to cover:**

- XP for correct/incorrect exercise results
- perfect score bonus
- combo bonus calculation integration
- streak date transitions around local day boundaries if pure helpers exist
- milestone threshold detection

**Verification:**

```bash
npm test -- src/lib/server/gamification-rules.test.ts src/lib/server/gamification.test.ts
npm run validate
```

Adjust command to the actual test files created.

### Task 5.2: Add route request-validation tests for completion APIs

**Objective:** Protect key write endpoints before introducing shared API parsers.

**Files:**

- Create or modify: `src/routes/api/session/complete.server.test.ts`
- Create or modify: `src/routes/api/practice/complete.server.test.ts`

**Implementation guidance:**

Test invalid request paths without requiring real OpenAI/Turso where possible by mocking server modules.

At minimum cover:

- missing `userId`
- missing `sessionId`
- malformed/empty `results`
- fallback summary path when AI/budget unavailable
- XP failure remains non-fatal if current behavior says so

**Verification:**

```bash
npm test -- src/routes/api/session/complete.server.test.ts src/routes/api/practice/complete.server.test.ts
npm run validate
```

### Task 5.3: Add auth/session tests

**Objective:** Protect site auth token behavior before workflow/CI exposes it broadly.

**Files:**

- Modify or create: `src/lib/server/auth.test.ts`

**Test cases:**

- valid token validates
- tampered signature fails
- expired token fails
- future timestamp fails
- timing-safe mismatch does not throw on length differences
- `AUTH_SECRET` override changes signature behavior if practical to test

**Verification:**

```bash
npm test -- src/lib/server/auth.test.ts
npm run validate
```

---

## 12. Phase 6 — DB module decomposition

Do this after validator/helper tests are in place. This phase is intentionally staged to avoid a risky all-at-once rewrite.

### Task 6.1: Extract DB client and schema without changing public imports

**Objective:** Reduce `db.ts` responsibility while keeping existing imports working.

**Files:**

- Modify: `src/lib/server/db.ts`
- Create: `src/lib/server/db-client.ts`
- Create: `src/lib/server/db-schema.ts`
- Create: `src/lib/server/db-migrations.ts`
- Create: `src/lib/server/db-mappers.ts`
- Tests if helpers are pure:
  - `src/lib/server/db-migrations.test.ts`
  - `src/lib/server/db-mappers.test.ts`

**Implementation guidance:**

- First extraction should be mechanical.
- Keep exported API from `src/lib/server/db.ts` unchanged.
- Move only these concerns initially:
  - `getClient` / client lifecycle into `db-client.ts`, if clean
  - schema statement construction into `db-schema.ts`
  - migration helpers into `db-migrations.ts`
  - row mapping into `db-mappers.ts`
- If moving `getClient` is too risky due to initialization cycles, start with schema/mappers only.

**Verification:**

```bash
npm test -- src/lib/server/db-migrations.test.ts src/lib/server/db-mappers.test.ts 2>/dev/null || true
npm run validate
npm run build
```

### Task 6.2: Make migrations column-aware/idempotent

**Objective:** Make startup migrations safer if migration marker state and actual schema diverge.

**Files:**

- Modify: `src/lib/server/db-migrations.ts`
- Modify: `src/lib/server/db.ts` if still orchestrating startup
- Add/modify: `src/lib/server/db-migrations.test.ts`

**Known risk:**

`portfolio_v2_session_columns` currently relies on a migration key before running multiple `ALTER TABLE ... ADD COLUMN` statements. If the key is missing but some columns already exist, startup can fail.

**Implementation guidance:**

- Add helper functions for:
  - checking table existence
  - checking column existence
  - adding column if missing
  - recording migration key after all changes are safe
- Do not drop data.
- Do not rename or remove columns.

**Tests:**

Use pure helper tests where possible. If using a DB test, use an in-memory/local libsql setup only if already practical in the project.

**Verification:**

```bash
npm run validate
npm run build
```

### Task 6.3: Normalize mission table relationship constraints cautiously

**Objective:** Document and, if safe, align FK/index conventions for mission-related tables.

**Files:**

- Review: `src/lib/server/db.ts`
- Review: `src/lib/server/missions-db.ts`
- Possibly modify: `src/lib/server/db-schema.ts`
- Possibly modify: `src/lib/server/db-migrations.ts`
- Document decision if behavior is changed: `documents/decisions/NNN-mission-db-constraints.md`

**Known observation:**

Some newer mission/badge/limit tables do not declare foreign keys while older tables do.

**Implementation guidance:**

- First decide whether adding FKs is safe for existing deployed data.
- If not safe now, document the decision and leave code unchanged.
- If safe, add a migration plan that preserves data and handles orphan rows deliberately.

**Verification:**

```bash
npm run validate
npm run build
```

---

## 13. Phase 7 — AI module decomposition

Do this after shared validators exist. Keep tests green after each extraction.

### Task 7.1: Extract AI model/client/config boundaries

**Objective:** Centralize AI model constants and OpenAI client creation.

**Files:**

- Modify: `src/lib/server/ai.ts`
- Modify: `src/lib/server/portfolio-challenge.ts`
- Create: `src/lib/server/ai-models.ts`
- Create: `src/lib/server/openai-client.ts`
- Add tests if pure behavior exists.

**Current duplication:**

- `SESSION_MODEL = 'gpt-5.4'` in `src/lib/server/ai.ts`
- `PORTFOLIO_MODEL = 'gpt-5.4'` in `src/lib/server/portfolio-challenge.ts`
- OpenAI client setup appears in more than one module.

**Implementation guidance:**

- Export named constants for current model usage.
- Do not change the actual model unless separately requested.
- Keep missing API key error behavior compatible with current tests.

**Verification:**

```bash
npm test -- src/lib/server/ai.session-summary.test.ts src/lib/server/ai.public-challenge.test.ts
npm run validate
```

### Task 7.2: Extract AI prompt builders and normalizers

**Objective:** Make `ai.ts` easier to reason about without changing prompt contracts.

**Files:**

- Modify: `src/lib/server/ai.ts`
- Create candidates:
  - `src/lib/server/ai-session-prompts.ts`
  - `src/lib/server/ai-session-normalizers.ts`
  - `src/lib/server/ai-summary-prompts.ts`
  - `src/lib/server/ai-public-challenge.ts`

**Implementation guidance:**

- Move pure prompt-construction functions first.
- Move pure normalization/validation functions second.
- Keep exported functions from `ai.ts` stable:
  - `generateSessionPlan`
  - `generateSessionSummary`
  - `generateUpdatedJournal`
  - any currently imported public challenge functions
- Prefer small mechanical moves with tests after each move.

**Verification after each extraction:**

```bash
npm test -- src/lib/server/ai.session-summary.test.ts src/lib/server/ai.public-challenge.test.ts
npm run check
npm run lint
```

Phase-end verification:

```bash
npm run validate
npm run build
```

### Task 7.3: Sanitize and standardize AI logging

**Objective:** Avoid accidental learner-content leakage and reduce ad hoc console usage.

**Files:**

- Create: `src/lib/server/logger.ts`
- Modify: `src/lib/server/ai.ts`
- Modify: `src/lib/server/missions-ai.ts`
- Modify: `src/lib/server/portfolio-challenge.ts`
- Modify other server modules only if touched.

**Implementation guidance:**

Start minimal:

- `logInfo(scope, message, meta?)`
- `logWarn(scope, message, meta?)`
- `logError(scope, message, meta?)`
- `sanitizeMeta(meta)` or explicit helper for AI previews

Do not introduce a heavy logging library unless there is a separate decision.

For AI outputs:

- Avoid logging full model output.
- If keeping previews, truncate and ensure they do not contain sensitive credentials. Prefer metadata counts/status over content previews.

**Verification:**

```bash
npm run lint
npm test -- src/lib/server/ai.session-summary.test.ts src/lib/server/missions-ai.test.ts src/lib/server/ai.public-challenge.test.ts
npm run validate
```

---

## 14. Phase 8 — API/profile boundary hardening

### Task 8.1: Add selected-user API helper

**Objective:** Make profile-scoped mutations consistent without building full multi-user auth.

**Files:**

- Create: `src/lib/server/selected-user.ts`
- Add tests if helper is pure enough: `src/lib/server/selected-user.test.ts`
- Later route migrations should import this helper.

**Implementation guidance:**

The helper should support current app behavior:

- read `selected_user` cookie
- normalize user IDs
- provide a way to compare selected user with a body `userId`
- return a structured failure instead of throwing where useful

Do not immediately apply to every route until tests confirm the frontend sends consistent IDs.

**Verification:**

```bash
npm test -- src/lib/server/selected-user.test.ts 2>/dev/null || true
npm run check
npm run lint
```

### Task 8.2: Migrate one low-risk API route to shared request/profile helpers

**Objective:** Prove the helper pattern on a small endpoint before migrating critical endpoints.

**Candidate files:**

- `src/routes/api/user/writing-toggle/+server.ts`
- `src/routes/api/user/level/+server.ts`

**Implementation guidance:**

- Add/adjust route tests first if practical.
- Use shared JSON body parsing helper from Phase 4.
- Use selected-user helper if the endpoint mutates a selected profile.
- Preserve current response shape unless deliberately documented.

**Verification:**

```bash
npm test -- src/routes/api/user/level.server.test.ts src/routes/api/user/writing-toggle.server.test.ts 2>/dev/null || true
npm run validate
```

### Task 8.3: Gradually migrate high-risk write APIs

**Objective:** Reduce casts and inconsistent request handling in critical mutation endpoints.

**Candidate files:**

- `src/routes/api/session/generate/+server.ts`
- `src/routes/api/session/complete/+server.ts`
- `src/routes/api/practice/generate/+server.ts`
- `src/routes/api/practice/complete/+server.ts`
- `src/routes/api/missions/[id]/start/+server.ts`
- `src/routes/api/missions/[id]/respond/+server.ts`
- `src/routes/api/missions/[id]/complete/+server.ts`

**Implementation guidance:**

- Do one route per task/commit.
- Add route-level tests before or during migration.
- Preserve current API response shapes.
- If profile mismatch handling changes behavior, document it in `documents/decisions/` first.

**Verification after each route:**

```bash
npm test -- <relevant-test-file>
npm run validate
```

---

## 15. Phase 9 — Background task boundary

### Task 9.1: Add background task helper

**Objective:** Centralize non-fatal fire-and-forget behavior.

**Files:**

- Create: `src/lib/server/background-task.ts`
- Create tests if useful: `src/lib/server/background-task.test.ts`
- Modify later tasks:
  - `src/routes/api/session/complete/+server.ts`
  - `src/routes/api/practice/complete/+server.ts`

**Implementation guidance:**

Start minimal:

```ts
export function runBackgroundTask(name: string, task: () => Promise<void>): void {
  void task().catch((error) => {
    // use logger from Phase 7 if available
  });
}
```

- Do not add queues/workers.
- Preserve current non-blocking behavior.
- Ensure rejected background promises are always logged once.

**Verification:**

```bash
npm test -- src/lib/server/background-task.test.ts 2>/dev/null || true
npm run validate
```

### Task 9.2: Move journal update fire-and-forget calls to helper

**Objective:** Make background AI journal updates explicit and consistent.

**Files:**

- Modify: `src/routes/api/session/complete/+server.ts`
- Modify: `src/routes/api/practice/complete/+server.ts`
- Possibly modify: `src/lib/server/background-task.ts`

**Implementation guidance:**

- Preserve successful journal update behavior.
- Preserve non-fatal failure behavior.
- Use structured logging if logger exists.
- Keep token usage recording behavior unchanged.

**Verification:**

```bash
npm test -- src/routes/api/session/complete.server.test.ts src/routes/api/practice/complete.server.test.ts 2>/dev/null || true
npm run validate
```

---

## 16. Phase 10 — Svelte page/component modularization

This phase is lower priority than workflow, CI, validators, and server boundaries. Do it gradually.

### Task 10.1: Extract Learn page state helpers

**Objective:** Reduce `src/routes/learn/+page.svelte` complexity without visual changes.

**Files:**

- Modify: `src/routes/learn/+page.svelte`
- Create candidates:
  - `src/routes/learn/session-storage.ts`
  - `src/routes/learn/learn-page-state.ts`
- Add tests if helpers are pure:
  - `src/routes/learn/session-storage.test.ts`

**Implementation guidance:**

- Move sessionStorage key handling and parse/restore logic first.
- Do not change UI markup/styles in the same task unless required by extraction.
- Preserve Svelte 5 runes usage.

**Verification:**

```bash
npm test -- src/routes/learn/session-storage.test.ts 2>/dev/null || true
npm run check
npm run lint
npm run build
```

### Task 10.2: Extract Mission page storage/state helpers

**Objective:** Reduce `src/routes/missions/[id]/+page.svelte` complexity without behavior changes.

**Files:**

- Modify: `src/routes/missions/[id]/+page.svelte`
- Create candidates:
  - `src/routes/missions/[id]/mission-storage.ts`
  - `src/routes/missions/[id]/mission-page-state.ts`
- Add tests if helpers are pure.

**Verification:**

```bash
npm run check
npm run lint
npm run build
```

### Task 10.3: Extract reusable display primitives from large components

**Objective:** Reduce large style-heavy Svelte files gradually.

**Candidate files:**

- `src/lib/components/SessionSummary.svelte`
- `src/routes/progress/+page.svelte`
- `src/routes/portfolio/challenge/+page.svelte`
- `src/lib/components/exercises/TranslationExercise.svelte`

**Implementation guidance:**

- One component/page per task.
- Extract only obvious repeated display sections or pure formatting helpers.
- Avoid visual redesign.
- If changing markup/classes, manually inspect page in dev server or browser where possible.

**Verification:**

```bash
npm run check
npm run lint
npm run build
```

If a browser/dev-server check is performed, record what was checked in the handoff.

---

## 17. Phase 11 — Final integration and documentation closure

### Task 11.1: Final full validation

**Objective:** Prove all internal changes are safe together.

**Files:** none unless fixing discovered issues.

**Run:**

```bash
npm run validate:ci
```

Expected:

- formatting passes
- Svelte check passes
- eslint passes
- Vitest passes
- build passes

Record the exact final output summary in the handoff.

### Task 11.2: Update docs index and plan status

**Objective:** Mark this plan and related docs accurately after implementation.

**Files:**

- Modify: `documents/INDEX.md`
- Modify: `documents/plans/2026-05-06-technical-debt-agentic-workflow-improvements.md`

**Implementation guidance:**

- Update this plan’s status to one of:
  - partially implemented
  - implemented
  - superseded
- Add notes about which phases were completed and which remain.
- Do not delete incomplete tasks; mark them explicitly.

**Verification:**

```bash
npm run format:check
```

---

## 18. Acceptance criteria for the whole plan

The improvement program is considered successful when:

1. A new agent can start from `AGENTS.md` and know exactly how to work in the repo.
2. `documents/CONTRIBUTING.md` reflects current agentic workflow, validation gates, and no-feature-drift rules.
3. `npm run validate:ci` exists and is documented.
4. GitHub Actions runs `npm run validate:ci`.
5. Dependency vulnerabilities are remediated or any residual advisories are explicitly documented with rationale and follow-up ownership.
6. README no longer contains known stale route/cookie/schema references.
7. `.env.example` documents all source-used env vars or explicitly marks deprecated ones.
8. `.idea/` no longer pollutes normal git status unless intentionally tracked.
9. Duplicated `SessionMeta` parsing is centralized and tested.
10. Duplicated combo and abort helpers are centralized and tested.
11. DB schema/migration/mapping logic is at least partially extracted from `db.ts` while public imports remain stable.
12. AI client/model/prompt/normalization logic is at least partially extracted from `ai.ts` while public imports remain stable.
13. Key route and pure-logic tests cover the riskiest write paths and calculations.
14. Background journal update behavior is explicit and consistently logged.
15. Large Svelte pages have begun moving storage/state logic out of markup-heavy files.
16. Final `npm run validate:ci` passes.

---

## 19. Risks and open questions

1. **Node version choice:** Need to inspect current local/hosting runtime before pinning `.nvmrc` and `engines.node`.
2. **GitHub Actions availability:** If the repo is not hosted on GitHub, replace Phase 2.2 with the equivalent CI provider.
3. **DB migration safety:** Adding FKs or changing migration behavior can break deployed data if not checked carefully. Prefer column-aware, additive migrations first.
4. **Profile mismatch behavior:** Enforcing `selected_user` vs body `userId` may change behavior. Add tests and document the intended policy before applying broadly.
5. **AI logging:** Removing model output previews may reduce debugging convenience. Prefer sanitized/short metadata logs over full content.
6. **Large refactors:** Splitting `ai.ts` and `db.ts` should be mechanical and phased. Avoid mixing extraction with behavior changes.
7. **Docs volume:** The repo already has many docs. The index/status labels are important to prevent new docs from becoming more noise.

---

## 20. Suggested first implementation batch

If executing immediately, start with this small, high-leverage batch. This batch is now complete in commit `2e7b507`:

1. [x] Task 0.1 — confirm baseline.
2. [x] Task 3.4 — ignore `.idea/` and align prettier ignore.
3. [x] Task 1.1 — add `AGENTS.md`.
4. [x] Task 2.1 — add `validate:ci` and align docs.
5. [x] Task 2.2 — add CI workflow.
6. [x] Task 3.1 — fix README drift.
7. [x] Task 4.2 — centralize `SessionMeta` parsing.
8. [x] Task 4.3 — centralize combo helper.

This batch gives future agents better bootstrapping, a real quality gate, cleaner status, and the first safe code-level debt reductions without entering the largest refactors yet.

Next agents should continue from the unfinished lanes listed in section 3.1 rather than repeating this batch.

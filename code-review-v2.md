# GSTACK /review Report (Consolidated)

- **Date:** 2026-04-02
- **Project:** japanese-learner
- **Scope:** Consolidated findings from API, missions, frontend pages/stores, components/utils, and backend core reviews
- **Report ID Prefix:** `CR2-`

## Executive summary

| Severity  |  Count |
| --------- | -----: |
| Critical  |      1 |
| High      |      9 |
| Medium    |      9 |
| Low       |      8 |
| **Total** | **27** |

This consolidated review identifies one critical authorization flaw, multiple high-impact correctness and integrity issues, and several medium/low reliability and maintainability problems. Immediate attention should focus on identity binding, unsafe type-cast contract drift, budget/accounting correctness, and idempotent/atomic backend workflows.

## Detailed findings by severity

### Critical

#### CR2-001

- **Severity:** Critical
- **Category:** bug
- **Confidence:** 10/10
- **File:line:** `src/hooks.server.ts:33` and protected API routes
- **Problem:** Authenticated user is not bound to requested `userId`; clients can act on behalf of other users.
- **Impact:** Full cross-user action risk on protected APIs (authorization bypass / IDOR-style behavior).
- **Recommended fix:** Enforce server-side ownership binding: derive effective user identity from authenticated session context and reject mismatched `userId` in requests.

### High

#### CR2-002

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/routes/api/check-answer/+server.ts:14-17`
- **Problem:** Endpoint trusts `selected_user` cookie as identity without ownership validation.
- **Impact:** Cookie tampering can let clients act as another user in answer-check flow.
- **Recommended fix:** Validate cookie user against authenticated principal and DB ownership before processing.

#### CR2-003

- **Severity:** High
- **Category:** bad-practice
- **Confidence:** 10/10
- **File:line:** `src/routes/api/session/complete/+server.ts:270-272`, `src/routes/api/practice/complete/+server.ts:164-166`, `src/lib/server/gamification.ts:517-522`
- **Problem:** Unsafe cast hides mismatched signature; `localDate` is passed but ignored.
- **Impact:** Type safety is bypassed and behavior silently diverges from developer intent.
- **Recommended fix:** Align function signatures and call sites; remove unsafe cast and make `localDate` either truly supported or explicitly removed.

#### CR2-004

- **Severity:** High
- **Category:** bug
- **Confidence:** 10/10
- **File:line:** `src/lib/server/missions-ai.ts:267`
- **Problem:** Practice choices can be unwinnable (required correct option may be missing).
- **Impact:** Users can receive impossible questions, breaking trust and progression quality.
- **Recommended fix:** Guarantee inclusion of the required correct option and add validation guard before returning generated choices.

#### CR2-005

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/lib/server/missions-seed.ts:367`
- **Problem:** Seeding is not idempotent for partial seed states.
- **Impact:** Re-running seed can duplicate or corrupt mission seed state.
- **Recommended fix:** Make seed steps idempotent with deterministic upsert logic and explicit state checkpoints.

#### CR2-006

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/routes/learn/+page.svelte:72`, `src/routes/practice/+page.svelte:55`, `src/routes/missions/[id]/+page.svelte:70`
- **Problem:** Session restore keys are not user-scoped.
- **Impact:** Cross-user/browser-profile leakage or accidental restore of another user’s in-progress state.
- **Recommended fix:** Namespace restore keys by stable user identifier (and optionally course/mission context).

#### CR2-007

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/routes/missions/[id]/+page.svelte:345`
- **Problem:** Mission completion can be submitted multiple times.
- **Impact:** Duplicate completion events, reward inflation, and inconsistent mission state.
- **Recommended fix:** Add client submission lock and server-side idempotency/duplicate-check enforcement.

#### CR2-008

- **Severity:** High
- **Category:** bug
- **Confidence:** 10/10
- **File:line:** `src/lib/server/token-limiter.ts:68`
- **Problem:** Monthly budget is computed globally, not per user.
- **Impact:** One user’s usage can exhaust budget for all users (incorrect quota enforcement).
- **Recommended fix:** Calculate/enforce budget on a per-user key and persist scoped counters consistently.

#### CR2-009

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/lib/server/gamification-backfill.ts:103-106,139-153`
- **Problem:** Backfill can get stuck in partially migrated state.
- **Impact:** Incomplete migrations and repeated failures with no clean convergence.
- **Recommended fix:** Make backfill resumable and transactional with explicit migration markers/checkpoints.

#### CR2-010

- **Severity:** High
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/lib/server/ai.ts:381-399,477-484`
- **Problem:** No validation that `correctAnswer` exists in `choices`.
- **Impact:** Invalid exercises and incorrect grading logic can be emitted downstream.
- **Recommended fix:** Validate generated payload invariants (`correctAnswer ∈ choices`) and retry/fail closed when invalid.

### Medium

#### CR2-011

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/routes/api/tts/+server.ts:21-26`
- **Problem:** Rate-limit key trusts raw `x-forwarded-for`.
- **Impact:** Header spoofing can evade or skew rate limits.
- **Recommended fix:** Use trusted proxy parsing rules and fallback to server-observed client address when trust is not established.

#### CR2-012

- **Severity:** Medium
- **Category:** bad-practice
- **Confidence:** 9/10
- **File:line:** `src/routes/api/tts/+server.ts:11,40-56`
- **Problem:** Unbounded in-memory rate-limit map can grow indefinitely.
- **Impact:** Memory growth risk and non-deterministic limiter behavior over long uptime.
- **Recommended fix:** Add bounded eviction/TTL cleanup or move limiter state to durable centralized storage.

#### CR2-013

- **Severity:** Medium
- **Category:** bad-practice
- **Confidence:** 9/10
- **File:line:** `src/lib/server/missions-ai.ts:82`
- **Problem:** Token usage model is mislabeled (`SESSION_MODEL` used even for evaluation).
- **Impact:** Usage/accounting analytics become inaccurate and harder to audit.
- **Recommended fix:** Record the actual model used per operation and standardize usage-event schema.

#### CR2-014

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/lib/server/missions-seed.ts:362`
- **Problem:** Check-then-insert seeding path is non-atomic and race-prone.
- **Impact:** Concurrent seed runs can produce duplicates or inconsistent state.
- **Recommended fix:** Replace check-then-insert with atomic upsert/unique constraints inside transaction.

#### CR2-015

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 7/10
- **File:line:** `src/routes/progress/+page.svelte:23-44`
- **Problem:** Calendar day keys use browser local timezone, not app timezone.
- **Impact:** Day-boundary drift causes inaccurate daily progress display.
- **Recommended fix:** Normalize day keys to a single configured app timezone on both compute and render paths.

#### CR2-016

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 8/10
- **File:line:** `src/lib/components/SessionRenderer.svelte:24`
- **Problem:** Unknown exercise types are silently rendered as Listening.
- **Impact:** Data/schema errors are masked and users see incorrect UI.
- **Recommended fix:** Fail explicitly for unknown types (error state + logging) rather than defaulting silently.

#### CR2-017

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 9/10
- **File:line:** `src/lib/server/db.ts:125-335`
- **Problem:** DB init failure becomes permanent until process restart.
- **Impact:** Transient startup/runtime failures can permanently disable DB access in-process.
- **Recommended fix:** Reset failed init state and allow controlled re-initialization retries with backoff/logging.

#### CR2-018

- **Severity:** Medium
- **Category:** bug
- **Confidence:** 8/10
- **File:line:** `src/lib/server/db.ts:597-607 and 690-707`
- **Problem:** Multi-row writes are non-transactional.
- **Impact:** Partial writes can leave inconsistent relational state.
- **Recommended fix:** Wrap related multi-row mutations in explicit DB transactions.

#### CR2-019

- **Severity:** Medium
- **Category:** bad-practice
- **Confidence:** 8/10
- **File:line:** `src/lib/server/ai.ts:1098-1101`
- **Problem:** Raw model output is logged verbatim.
- **Impact:** Sensitive/user-derived content may be overexposed in logs.
- **Recommended fix:** Redact/summarize model outputs and gate verbose payload logging behind safe debug controls.

### Low

#### CR2-020

- **Severity:** Low
- **Category:** bad-practice
- **Confidence:** 8/10
- **File:line:** `src/routes/api/session/generate/+server.ts:118-161`
- **Problem:** Duplicative session-history pipelines diverge in behavior.
- **Impact:** Maintenance overhead and subtle behavior drift across paths.
- **Recommended fix:** Consolidate into one shared pipeline with explicit mode/config flags.

#### CR2-021

- **Severity:** Low
- **Category:** dead-code
- **Confidence:** 10/10
- **File:line:** `src/lib/server/missions-ai.ts:568`
- **Problem:** `missionId` parameter is unused.
- **Impact:** Misleading API contract and unnecessary parameter propagation.
- **Recommended fix:** Remove the unused parameter or implement its intended use.

#### CR2-022

- **Severity:** Low
- **Category:** dead-code
- **Confidence:** 10/10
- **File:line:** `src/routes/+page.server.ts:55-78,107-118`
- **Problem:** Unused stats query path.
- **Impact:** Extra code path increases maintenance burden and cognitive load.
- **Recommended fix:** Delete unused query path or wire it into actual consumer flow.

#### CR2-023

- **Severity:** Low
- **Category:** dead-code
- **Confidence:** 9/10
- **File:line:** `src/lib/components/missions/MissionChoices.svelte:15`
- **Problem:** Unreachable branch in class resolver.
- **Impact:** Dead branch obscures true rendering logic.
- **Recommended fix:** Remove unreachable branch and simplify resolver conditions.

#### CR2-024

- **Severity:** Low
- **Category:** bad-practice
- **Confidence:** 9/10
- **File:line:** `src/lib/components/InlineAudio.svelte:14` and `src/lib/components/exercises/ListeningExercise.svelte:13`
- **Problem:** Duplicated text-cleaning utility logic.
- **Impact:** Fixes must be duplicated; behavior can drift between components.
- **Recommended fix:** Extract shared utility into one canonical helper and reuse.

#### CR2-025

- **Severity:** Low
- **Category:** bad-practice
- **Confidence:** 8/10
- **File:line:** `src/lib/components/LevelBadge.svelte:2-15`
- **Problem:** Loose component contract and duplicated canonical labels.
- **Impact:** Inconsistent label behavior and harder component reuse.
- **Recommended fix:** Tighten prop contract and centralize canonical label mapping.

#### CR2-026

- **Severity:** Low
- **Category:** bug
- **Confidence:** 8/10
- **File:line:** `src/lib/components/ProgressBar.svelte:8-16`
- **Problem:** Zero-total state is displayed as 1.
- **Impact:** Misleading progress display at empty baseline.
- **Recommended fix:** Handle `total = 0` explicitly with a deterministic zero-state UI.

#### CR2-027

- **Severity:** Low
- **Category:** dead-code
- **Confidence:** 10/10
- **File:line:** `src/lib/server/token-limiter.ts:139-146,181`
- **Problem:** Unused exported aliases/functions.
- **Impact:** API surface bloat and maintenance noise.
- **Recommended fix:** Remove unused exports or add real call sites/tests if required.

## Dead / Unused Code

Dead or effectively unused findings in this review:

- **CR2-021** — Unused `missionId` parameter (`src/lib/server/missions-ai.ts:568`)
- **CR2-022** — Unused stats query path (`src/routes/+page.server.ts:55-78,107-118`)
- **CR2-023** — Unreachable resolver branch (`src/lib/components/missions/MissionChoices.svelte:15`)
- **CR2-027** — Unused exported aliases/functions (`src/lib/server/token-limiter.ts:139-146,181`)

Related maintainability duplication (not strictly dead code): **CR2-024**, **CR2-020**.

## Confirmed from previous review (code-review.md)

The following findings overlap with previously reported items in `code-review.md`:

- **Unsafe type cast / localDate mismatch** — **CR2-003**, previously **CR-002**
- **`selected_user` trust issue in check-answer** — **CR2-002**, previously **CR-001** (related)
- **In-memory rate limiter concerns** — **CR2-012**, previously **CR-005** (related)

## Prioritized fix order

1. **CR2-001** — enforce authenticated user ↔ requested user binding across protected APIs.
2. **CR2-002** and **CR2-003** — close identity trust gap and remove unsafe cast/signature drift.
3. **CR2-008**, **CR2-010**, **CR2-004** — correct quota and exercise correctness invariants.
4. **CR2-005**, **CR2-009**, **CR2-014**, **CR2-018** — make seed/backfill/write paths idempotent and transactional.
5. **CR2-011**, **CR2-012**, **CR2-017**, **CR2-019** — harden operational reliability and observability/privacy.
6. **CR2-006**, **CR2-007**, **CR2-015**, **CR2-016**, **CR2-026** — resolve user-facing state/UX correctness issues.
7. **CR2-020** to **CR2-025**, **CR2-027** — clean dead/duplicate code and tighten component/contracts.

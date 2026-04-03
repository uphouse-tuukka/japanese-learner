# Code Review Report

Date: 2026-04-02  
Project: japanese-learner (SvelteKit)  
Scope: Full codebase review — bugs, bad practices, dead/unused code

## Summary

10 findings across the codebase. No critical-severity issues. Two high-severity items (missing user validation, unsafe type casting) should be addressed first.

| Severity | Count |
| -------- | ----- |
| Critical | 0     |
| High     | 2     |
| Medium   | 4     |
| Low      | 4     |

## Findings

### CR-001 — Missing user ID validation in check-answer endpoint

- **Severity:** High
- **Category:** Bug
- **File:** `src/routes/api/check-answer/+server.ts`

The endpoint reads the `selected_user` cookie but doesn't validate that the user actually exists in the database before proceeding. The userId is passed to `checkAnswerWithAI` without verifying it corresponds to a real user record. Other API endpoints validate the user exists via `getUserById(userId)` — this one does not.

**Impact:** API can operate with a stale or invalid user cookie, potentially causing database errors or incorrect behavior downstream.

**Fix:** Add a `getUserById(userId)` check before processing, consistent with other endpoints.

---

### CR-002 — Unsafe type casting bypasses TypeScript safety

- **Severity:** High
- **Category:** Bad practice
- **Files:**
  - `src/routes/api/practice/complete/+server.ts:164-166`
  - `src/routes/api/session/complete/+server.ts:270-272`

Both files use `as unknown as ProcessSessionCompletionWithLocalDate` to force a type cast and pass a 5th parameter (`localDate`) to `processSessionCompletion`, but the actual function only accepts 4 parameters. The `localDate` parameter is silently ignored at runtime.

**Impact:** Defeats TypeScript's type checking. If someone expects `localDate` to have an effect, behavior will be silently wrong with no compile-time warning.

**Fix:** Either add `localDate` as an actual parameter to `processSessionCompletion`, or remove the unsafe casting and stop passing `localDate`.

---

### CR-003 — Fire-and-forget promise can fail silently

- **Severity:** Medium
- **Category:** Bug
- **File:** `src/routes/api/practice/complete/+server.ts:74-110`

The `runJournalUpdateInBackground` function uses a `void (async () => { ... })()` pattern. If the async IIFE throws synchronously or `Promise.all()` rejects in a way that escapes the try/catch, the rejection is unhandled.

**Impact:** Unhandled promise rejection warnings in edge cases; background work silently fails.

**Fix:** Attach `.catch()` to the void expression: `void (async () => {...})().catch(err => console.error(err))`.

---

### CR-004 — Inconsistent fire-and-forget error handling

- **Severity:** Medium
- **Category:** Bug
- **File:** `src/routes/api/session/complete/+server.ts:215-227`

The `.then(async (journalResult) => { await updateProgressJournal(...); await recordUsageEvent(...); })` pattern chains async calls inside `.then()`. If `updateProgressJournal` or `recordUsageEvent` throw, errors may not propagate correctly to the `.catch()` handler.

**Impact:** Background journal updates and usage events can fail silently, leading to data inconsistency.

**Fix:** Wrap the async operations in a properly structured try/catch inside the `.then()` callback.

---

### CR-005 — Module-level rate limiting state (memory leak risk)

- **Severity:** Medium
- **Category:** Bad practice
- **Files:**
  - `src/routes/api/tts/+server.ts:11`
  - `src/routes/api/auth/login/+server.ts:17`

Rate limit tracking uses module-level `Map` objects that persist in server memory. These don't survive server restarts, don't work across multiple server instances, and can grow unbounded if cleanup doesn't run frequently enough.

**Impact:** Rate limiting is unreliable in production. Memory usage can grow if many unique IPs/users hit the API without triggering cleanup.

**Fix:** Document the single-server limitation, or move to database/Redis-backed rate limiting for production.

---

### CR-006 — Potential null access after database query

- **Severity:** Medium
- **Category:** Bug
- **File:** `src/routes/api/session/complete/+server.ts:155-190`

`getUserById(userId)` can return null. While the current conditional logic (`!user`) protects against this, the code structure means a future refactor could easily introduce a null pointer access on `user.level` at line 190.

**Impact:** Defensive programming concern — currently safe but fragile under refactoring.

**Fix:** Add explicit non-null assertion after the check, or restructure to make null handling unambiguous.

---

### CR-007 — Weak JSON parsing without type guards

- **Severity:** Low
- **Category:** Bad practice
- **File:** `src/lib/server/answer-checker.ts:81-95`

`JSON.parse(outputText)` doesn't validate the response structure before accessing properties. If the AI returns unexpected JSON, the code silently defaults without logging what was received.

**Impact:** Makes debugging API response changes very difficult. Incorrect behavior can be masked by silent defaults.

**Fix:** Add type guards and log warnings when the structure doesn't match expectations.

---

### CR-008 — Confusing validation logic order

- **Severity:** Low
- **Category:** Bug
- **File:** `src/routes/api/missions/[id]/respond/+server.ts:75-86`

The condition checks `typeof selectedChoiceIndex !== 'number'` inside a block already guarded by `typeof selectedChoiceIndex === 'number' || mode === 'practice'`. The logic works but is confusing — the nested check is only meaningful when the outer condition passed via `mode === 'practice'`.

**Impact:** Readability and maintenance risk. Error message is misleading about what actually failed.

**Fix:** Restructure to clearly separate: (1) practice mode requires the index, (2) if provided, it must be a valid integer.

---

### CR-009 — Empty catch blocks swallow errors

- **Severity:** Low
- **Category:** Bad practice
- **Files:**
  - `src/lib/stores/session.svelte.ts:115-117, 132-134, 160-162`
  - `src/lib/stores/gamification.svelte.ts:68-70, 82-84, 89-91`

Multiple empty catch blocks with only comments like `// sessionStorage may be unavailable`. No logging of any kind when storage operations fail.

**Impact:** When debugging why session state isn't persisting, there's zero visibility into whether storage operations are actually failing.

**Fix:** Add `console.debug` or `console.warn` logging even if the failure is expected.

---

### CR-010 — Missing transaction in batch deletes

- **Severity:** Low
- **Category:** Bad practice
- **File:** `src/lib/server/db.ts:763-795`

`deleteStaleGhostSessions` executes three separate DELETE queries (`session_exercises`, `token_usage`, `sessions`) without wrapping them in a transaction.

**Impact:** If any query fails mid-execution, the database is left in an inconsistent state with orphaned records.

**Fix:** Wrap all three DELETE statements in a transaction using `db.batch()`.

---

## Priority order for fixes

1. **CR-002** — Remove unsafe type casting (prevents silent bugs)
2. **CR-001** — Add user validation to check-answer endpoint (security)
3. **CR-003 + CR-004** — Fix fire-and-forget error handling (reliability)
4. **CR-010** — Add transaction to batch deletes (data integrity)
5. **CR-005** — Document or fix rate limiting approach (production readiness)
6. Remaining low-severity items as time permits

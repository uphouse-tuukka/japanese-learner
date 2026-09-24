# Engineering discipline

Read this for implementation, bug fixes, and software verification.
Research and planning alone do not require this guide.
Repository-specific validation commands and product or permission boundaries still apply.

## Repository Hygiene

- Check `git status --short` before and after editing, and preserve unrelated user or agent changes.
- When writing commit messages, never auto-add an agent name as a co-author.
- Never manually modify `CHANGELOG.md` files or any files marked as auto-generated.

## Technical Judgment

- When making technical decisions, do not give much weight to development cost.
  Prefer quality, simplicity, robustness, scalability, and long term maintainability.

## Implementation Discipline

- State material assumptions before editing when they affect scope or safety.
- Inspect the affected behaviour, surrounding code, and relevant tests before editing.
- Prefer the smallest coherent change that satisfies the request.
  Every changed line should trace to the task, verification, directly required cleanup, or the discovered defects covered under End-to-End Review.
- Clean up code that the task makes redundant, duplicated, unreachable, obsolete, or unused.
  This cleanup is part of the task.
- Do not bundle unrelated refactors, formatting, comment rewrites, documentation edits, or API changes.
- Update relevant tests to match intended behaviour; remove tests only when the behaviour they cover is obsolete or no longer applicable.
- Keep comments short and explain intent or constraints that are not evident from the code.
  Remove redundant explanations in comments you touch.

## Testing and Verification

- No tautological or change-detector tests: distinguish correct from incorrect observable behaviour.
  Derive expected values independently from requirements, specifications, or worked examples, never from production logic or the code under test.
- Do not merely restate implementation structure through broad snapshots, private state, or collaborator call counts and ordering.
  A behaviour-preserving refactor should not require mechanical test rewrites unless the changed detail is part of the public contract.
- In UI tests, exercise user interactions and assert accessible, user-visible outcomes rather than DOM structure.
- Keep tests deterministic and independent: control time, randomness, and external I/O; avoid test-order dependencies and shared mutable state.
- Define appropriate verification before editing, run focused checks while iterating, and complete required repository checks before calling work complete.
  After checks pass, broaden or repeat them only for new changes, failures, or unresolved concerns.
  Report what was verified and any checks that could not run.

## Bug Fixes

- When doing bug fixes, always start by reproducing the bug in an end-to-end setting that is as close as practical to how an end user experiences it.
  This ensures the fix addresses the real problem.

## Development Servers

- Whenever launching or opening a server that the user is intended to access, such as a server presenting visual variants, make it accessible from another computer over Tailscale because work on this machine is performed through SSH.
  Do not bind such servers only to localhost.
  Use a tailnet-accessible binding or Tailscale Serve as appropriate, keep the server off the public internet unless explicitly requested, and provide the reachable URL.

## End-to-End Review

The discovered defects below are an explicit exception to the usual restriction on unrelated changes.
Keep those fixes focused and respect project-specific product and permission boundaries.

- When end-to-end testing a product, be picky about the UI and care about pixel-level fit and finish.
  If something clearly looks off, even when it is not directly related to the current task, try to get it fixed along the way.
- Apply that same high standard to engineering excellence.
  If you see lint failures, test failures, or test flakiness, even when they were not caused by the current work, still get them fixed.

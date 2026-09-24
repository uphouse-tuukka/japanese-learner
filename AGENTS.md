# Agent Boot Guide

## Mission

Japanese Learner is a personal Japanese travel-readiness tutor for the owner and a few friends. It is not a scalable SaaS product; preserve the current learning flows unless a task explicitly says otherwise.

## Mandatory reading

Before editing, read:

- `README.md`
- `documents/CONTRIBUTING.md`
- the current task or plan in `documents/plans/*`
- relevant architecture/tooling decisions in `documents/decisions/*`

## Boot sequence

1. Run `git status --short --branch` and note existing user or agent changes.
2. Read the current task and any referenced plan before choosing files to edit.
3. Inspect relevant source files and tests before editing.
4. Identify the validation commands you will run before editing.
5. Avoid feature drift: keep the change inside the requested scope.

## Engineering guidance

For implementation, bug fixes, or software verification, read [Engineering discipline](docs/agents/engineering.md).
Research and planning alone do not require that guide.

## Branch and PR workflow

- For any project work in this repository — including new features, bug fixes,
  documentation updates, or agent-policy changes — do not work directly on the
  default branch.
- Create a focused feature/fix branch or worktree from the project default branch,
  make the change there, commit it, push it, and open a GitHub pull request
  against this repository.
- When the work is done, provide the User with the PR link in the normal GitHub format,
  for example `https://github.com/uphouse-tuukka/japanese-learner/pull/<number>`.
- Keep the PR focused and reviewable. Do not merge it without explicit instruction.

## Optional CodeGraph navigation

This repo has an optional, repo-local CodeGraph workflow for first-pass code navigation. Use it when mapping unfamiliar Svelte components, SvelteKit routes, server utilities, callers, callees, or impact surfaces.

- Keep it repo-local: do not install CodeGraph globally, run `codegraph install --target=hermes`, mutate Hermes/MCP config, or add it to CI/production automation.
- Run `npm run codegraph:preflight` before indexing. The preflight verifies `.codegraph/` is ignored and rejects symlinks that escape the repository.
- Initialize or refresh with `npm run codegraph:init`, `npm run codegraph:sync`, and inspect with `npm run codegraph:status`.
- Prefer exact commands such as `npm run codegraph:cli -- query SpeakingExercise --path .`, `npm run codegraph:cli -- callers checkSpeakingAnswer --path .`, and `npm run codegraph:cli -- impact ExerciseAnswerPayload --path .` before broad natural-language `context` prompts.
- Treat CodeGraph output as a navigation map, not proof. Read the source files it points to and run the required validation.

See `documents/decisions/005-codegraph-repo-local-navigation.md` for rationale, guardrails, and examples.

## Coding constraints

- Use SvelteKit 2 and Svelte 5 runes syntax.
- Keep TypeScript strict-mode compatible.
- Put server-only code in `src/lib/server/`.
- Use design tokens from `src/app.css` for UI styling.
- Exercise components must follow `documents/design/exercise-ui-guidelines.md` before adding component-local visual structure.

## Validation

For code changes, run the canonical CI gate:

- `npm run validate:ci`

For documentation-only changes, follow `documents/CONTRIBUTING.md` validation requirements unless the task explicitly scopes validation differently; also run requested doc validation such as `npm run format:check`.

`npm run validate` remains a shorter local check + lint + test shortcut when the full CI gate is not required.

## Subagent workflow

- Work in independent lanes and avoid overlapping edits to large files.
- Do not allow multiple agents to edit the same large file without coordination.
- Use spec-compliance review first, then code-quality review.
- For maintenance or refactor tasks, do not add user-facing features. Put feature ideas in the handoff parking lot instead of code.

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository's GitHub Issues.
See `docs/agents/issue-tracker.md`.

### Triage labels

The repository uses the five default triage labels.
See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository with domain language in `CONTEXT.md` and decisions in `documents/decisions/`.
See `docs/agents/domain.md`.

## Repository edits

Check Git status before and after edits and preserve unrelated user or agent changes.
Do not manually edit generated files or changelogs, or add agent co-authors to commits.

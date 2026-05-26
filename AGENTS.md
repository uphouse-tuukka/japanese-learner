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

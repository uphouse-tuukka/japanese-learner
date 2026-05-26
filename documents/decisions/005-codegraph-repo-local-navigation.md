# 005 — Repo-local CodeGraph navigation

Date: 2026-05-26
Status: decision

## Summary

Add CodeGraph as an optional, repo-local navigation aid for agents working in Japanese Learner. It is useful for first-pass mapping of Svelte components, SvelteKit route handlers, server utilities, callers, callees, and named-symbol impact surfaces. It is not evidence of correctness; source reads and project validation remain authoritative.

## Decision

Japanese Learner keeps CodeGraph usage inside this repository only:

- `.codegraph/` is ignored and may contain a local generated index.
- `package.json` exposes pinned npm-exec scripts for CodeGraph, using `@colbymchenry/codegraph@0.9.5`.
- `scripts/codegraph-preflight.mjs` must pass before initializing or syncing the index.
- CodeGraph is not added to `dependencies` or `devDependencies`.
- CodeGraph is not part of CI, production, cron, Telegram, global Hermes config, or Hermes MCP.

## Agent usage

Initialize or refresh the local index when mapping unfamiliar code:

```bash
npm run codegraph:preflight
npm run codegraph:init
npm run codegraph:status
npm run codegraph:sync
```

Use exact symbol or file-oriented commands before broad natural-language context prompts:

```bash
npm run codegraph:cli -- query SpeakingExercise --path .
npm run codegraph:cli -- callers checkSpeakingAnswer --path .
npm run codegraph:cli -- query ExerciseAnswerPayload --path .
npm run codegraph:cli -- impact ExerciseAnswerPayload --path .
npm run codegraph:cli -- query checkBudget --path .
npm run codegraph:cli -- callers checkBudget --path .
npm run codegraph:cli -- query api/missions --path .
```

Broad context prompts can still be useful for discovery, but they are noisier around generic terms such as `answer`, `complete`, `mission`, and `token`:

```bash
npm run codegraph:cli -- context "mission response completion flow" --path .
```

Treat CodeGraph output as a map to inspect, not proof. Read the files it points to and run the task's validation commands before claiming correctness.

## Guardrails

- Do not run `codegraph install --target=hermes` for this repo.
- Do not install CodeGraph globally just to work on this repo.
- Do not mutate `~/.hermes/config.yaml` or any global MCP config for CodeGraph.
- Do not commit `.codegraph/` or generated database artifacts.
- Do not use CodeGraph output to skip source inspection, tests, or `npm run validate:ci` when code changes are made.
- If the preflight fails, fix the repository boundary issue before indexing.

## Rationale

A guarded clone pilot on this SvelteKit/Svelte/TypeScript codebase showed that CodeGraph was useful for exact symbol, component, route, caller, and impact queries. It was weaker for broad natural-language context prompts, which sometimes mis-ranked overloaded terms.

The repo-local script approach captures the useful part while avoiding unnecessary global installation, dependency-surface changes, CI coupling, or Hermes configuration risk.

## Alternatives considered

### Global CodeGraph install

Rejected. It is unnecessary for this repo and makes the host/tool surface wider than needed.

### Hermes MCP integration

Rejected for now. It would mutate global agent configuration and is not needed for manual repo navigation. If MCP integration is reconsidered later, use Hermes-owned MCP configuration rather than a vendor installer.

### Add CodeGraph as a devDependency

Deferred. Pinned `npm exec` scripts are enough for optional use and keep app dependencies unchanged.

### Do nothing

Rejected. The tool helps agents build a first map faster on this codebase, as long as its output is treated as navigation guidance rather than correctness evidence.

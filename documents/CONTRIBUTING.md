# Contributing Guide — Japanese Learner

This document is mandatory reading for all AI agents and sessions working on this project.

## Project Overview

- **Purpose**: Personal Japanese learning app for travel readiness (1-2 year horizon)
- **Users**: Just the owner and a few friends — no scalability concerns
- **Stack**: SvelteKit 2, Svelte 5 (runes), TypeScript, Turso (libsql), OpenAI API
- **Hosting**: Vercel
- **Design**: Warm Japanese washi paper aesthetic (see `src/app.css` design tokens)

## Agent Boot Sequence

`AGENTS.md` is the root bootstrap document for AI agents. Read it before editing, then use this guide for project-specific workflow, docs, and review expectations.

1. Run `git status --short --branch` and note existing user or agent changes.
2. Read `README.md`, this guide, the current task or plan, and relevant decisions or analyses before choosing files to edit.
3. Inspect relevant source files and tests before editing; do not infer behavior from stale plans alone.
4. Identify the validation commands required for the task before editing.
5. Keep work inside the requested scope and call out any feature ideas in the handoff instead of implementing them.

## Agentic Work and Subagent Lanes

Use subagents in narrow lanes and avoid overlapping edits, especially in large Svelte pages, DB internals, AI internals, and route handlers. Coordinate explicitly before two agents touch the same lane.

| Lane | Ownership                 | Typical files                                                                                                |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A    | Docs and agent workflow   | `AGENTS.md`, `documents/CONTRIBUTING.md`, `documents/templates/*`, `documents/INDEX.md`, `README.md`         |
| B    | Tooling and CI            | `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.npmrc`, `.nvmrc`, `.env.example`, ignores |
| C    | Shared validators/helpers | `src/lib/validators/**`, `src/lib/utils/**`, `src/lib/server/request*.ts`, related tests                     |
| D    | DB internals              | `src/lib/server/db.ts`, `src/lib/server/db-*.ts`, `src/lib/server/repositories/**`, DB tests                 |
| E    | AI internals              | `src/lib/server/ai.ts`, `src/lib/server/ai-*.ts`, `src/lib/server/ai/**`, AI tests                           |
| F    | API/profile boundaries    | `src/routes/api/**/+server.ts`, `src/lib/server/api*.ts`, route tests                                        |
| G    | UI modularization         | large `.svelte` pages/components and extracted page-state modules                                            |

Use these templates for future structured docs:

- Plans: `documents/templates/plan-template.md`
- Decisions: `documents/templates/decision-template.md`
- Reviews: `documents/templates/review-template.md`

Required subagent handoff format:

```text
Task:
Files changed:
Behavior changed: yes/no. If yes, explain.
Tests run:
Validation result:
Risks / follow-ups:
```

## Review Gates

Run reviews in this order for each task or lane:

1. **Spec compliance review** — confirm the implementation matches the plan, avoids feature creep, and uses the correct paths and scope.
2. **Code quality review** — confirm the change is simpler or clearer, has adequate tests/docs, uses clear names and boundaries, and keeps secrets/user content protected in logs.
3. **Phase verification** — run the listed validation commands and record exact results in the final handoff.

## Maintenance / Refactor Non-Goals

For maintenance and refactor tasks, do not add user-facing features. Preserve existing learning flows unless a task explicitly asks for behavior changes. Put feature ideas, product redesigns, and nice-to-have improvements in the handoff as follow-ups instead of changing code.

## Code Quality

- **Linting**: ESLint (flat config in `eslint.config.js`)
  - Check: `npm run lint`
  - Auto-fix: `npm run lint:fix`
- **Formatting**: Prettier + `prettier-plugin-svelte`
  - Format all files: `npm run format`
  - Verify formatting: `npm run format:check`
- **Type checking**: `npm run check` (Svelte check + TypeScript)
- **Tests**: `npm test` (Vitest)
- **Full CI validation**: `npm run validate:ci` (runs format:check → check → lint → test → build)
- **Local validation shortcut**: `npm run validate` (runs check → lint → test)
- **Pre-commit hook**: Husky + lint-staged runs ESLint + Prettier on staged files on every commit. If lint fails, commit is blocked.

### Key lint/format rules

- `no-console`: only `console.warn` and `console.error` are allowed (`console.log` is not allowed)
- Unused vars prefixed with `_` are allowed (example: `_unused`)
- Prettier is the source of truth for formatting — do not manually fight it
- ESLint config uses flat config format in `eslint.config.js`

## Before Committing (AI Agent Rules)

All agents (coder, designer, planner) must do the following after making changes:

1. Run `npm run validate:ci`
2. Fix all errors before considering work done
3. Do not rely only on the pre-commit hook; fix lint/format issues proactively

Local shortcut: run `npm run validate` to run check + lint + test when a full CI gate is not required.

## Documentation Rules

**Every significant decision, plan, or analysis MUST be documented.** Do not leave knowledge only in chat sessions.

### When to document

- New feature plans → `documents/plans/`
- Architecture or tool decisions → `documents/decisions/` (use incrementing prefix: `001-`, `002-`, etc.)
- Technical analyses or comparisons → `documents/analyses/`
- Changes to AI prompts or session behavior → Update `documents/plans/ai-session-guidelines.md`

### Documentation format

- Use Markdown
- Start with a clear title and one-paragraph summary
- Include date of creation
- For decisions: state the decision, alternatives considered, and rationale
- For plans: include implementation steps, files affected, and open questions
- Use reusable templates when creating structured docs:
  - Plans: `documents/templates/plan-template.md`
  - Decisions: `documents/templates/decision-template.md`
  - Reviews: `documents/templates/review-template.md`
- Check `documents/INDEX.md` before following older plans so stale, implemented, and active docs are not confused

### What NOT to document here

- Temporary debugging notes (keep in session workspace)
- Trivial one-line fixes

## Coding Standards

### General

- Flat, explicit code over abstractions
- Small-to-medium functions; avoid deep nesting
- Descriptive names; comments only for non-obvious invariants
- Use framework conventions (SvelteKit routing, Svelte 5 runes)
- Always run `npm run validate:ci` after changes unless the task explicitly scopes validation differently

### Svelte Components

- Use `$props()`, `$state()`, `$derived()` runes (Svelte 5)
- Scoped `<style>` blocks per component
- Use CSS custom properties from `src/app.css` design tokens
- Exercise components must follow `documents/design/exercise-ui-guidelines.md`: shared exercise frame/result/status primitives, global button classes, and the exercise UI contract test for exercise UI changes
- Keep components focused — one responsibility per file

### Server Code

- All server-only code in `src/lib/server/`
- AI interactions in `src/lib/server/ai.ts`
- Database operations in `src/lib/server/db.ts`
- API routes under `src/routes/api/`

### AI Prompts

- All prompts MUST require romaji in parentheses for Japanese text
- Use structured JSON output where possible
- Log only sanitized AI diagnostics: metadata, counts, statuses, and short non-sensitive previews when needed. Do not log secrets, auth data, full prompts, raw user learning content, or complete raw AI payloads.
- Always include fallback behavior if AI call fails

### TTS

- Server TTS (OpenAI tts-1-hd, voice: nova) is preferred for sentences
- Browser TTS is acceptable for single words / short phrases
- TTS utility: `src/lib/utils/tts.ts`, audio playback: `src/lib/utils/audio.ts`
- Always handle loading/playing/stopped states in UI

## Key Architecture

### Data Flow

1. Session generated via AI → exercises stored in DB
2. User answers exercises → results collected in frontend store
3. Session completed → results sent to API → AI generates summary
4. Progress journal updated after each session (AI-maintained, stored on user record)

### Important Files

| Area                    | File(s)                                     |
| ----------------------- | ------------------------------------------- |
| DB schema & queries     | `src/lib/server/db.ts`                      |
| AI prompts & generation | `src/lib/server/ai.ts`                      |
| Types                   | `src/lib/types.ts`                          |
| Design tokens           | `src/app.css`                               |
| TTS utility             | `src/lib/utils/tts.ts`                      |
| Exercise components     | `src/lib/components/exercises/*.svelte`     |
| Session renderer        | `src/lib/components/SessionRenderer.svelte` |
| Session summary UI      | `src/lib/components/SessionSummary.svelte`  |

### Progress Journal

Each user has a `progress_journal` TEXT column that holds an AI-maintained cumulative summary of all their learning. It's updated after each session completion and passed to the summary AI so it can avoid repeating suggestions.

# Contributing Guide — Japanese Learner

This document is mandatory reading for all AI agents and sessions working on this project.

## Project Overview

- **Purpose**: Personal Japanese learning app for travel readiness (1-2 year horizon)
- **Users**: Just the owner and a few friends — no scalability concerns
- **Stack**: SvelteKit 2, Svelte 5 (runes), TypeScript, Turso (libsql), OpenAI API
- **Hosting**: Vercel
- **Design**: Warm Japanese washi paper aesthetic (see `src/app.css` design tokens)

## Code Quality

- **Linting**: ESLint (flat config in `eslint.config.js`)
  - Check: `npm run lint`
  - Auto-fix: `npm run lint:fix`
- **Formatting**: Prettier + `prettier-plugin-svelte`
  - Format all files: `npm run format`
  - Verify formatting: `npm run format:check`
- **Type checking**: `npm run check` (Svelte check + TypeScript)
- **Tests**: `npm test` (Vitest)
- **Full validation**: `npm run validate` (runs check → lint → test)
- **Pre-commit hook**: Husky + lint-staged runs ESLint + Prettier on staged files on every commit. If lint fails, commit is blocked.

### Key lint/format rules

- `no-console`: only `console.warn` and `console.error` are allowed (`console.log` is not allowed)
- Unused vars prefixed with `_` are allowed (example: `_unused`)
- Prettier is the source of truth for formatting — do not manually fight it
- ESLint config uses flat config format in `eslint.config.js`

## Before Committing (AI Agent Rules)

All agents (coder, designer, planner) must do the following after making changes:

1. Run `npm run lint`
2. Run `npm run check`
3. Run `npm test`
4. Fix all errors before considering work done
5. Do not rely only on the pre-commit hook; fix lint/format issues proactively

Shortcut: run `npm run validate` to run check + lint + test in one command.

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

### What NOT to document here

- Temporary debugging notes (keep in session workspace)
- Trivial one-line fixes

## Coding Standards

### General

- Flat, explicit code over abstractions
- Small-to-medium functions; avoid deep nesting
- Descriptive names; comments only for non-obvious invariants
- Use framework conventions (SvelteKit routing, Svelte 5 runes)
- Always run `npm run validate` after changes (`npm run check`, `npm run lint`, `npm test`)

### Svelte Components

- Use `$props()`, `$state()`, `$derived()` runes (Svelte 5)
- Scoped `<style>` blocks per component
- Use CSS custom properties from `src/app.css` design tokens
- Keep components focused — one responsibility per file

### Server Code

- All server-only code in `src/lib/server/`
- AI interactions in `src/lib/server/ai.ts`
- Database operations in `src/lib/server/db.ts`
- API routes under `src/routes/api/`

### AI Prompts

- All prompts MUST require romaji in parentheses for Japanese text
- Use structured JSON output where possible
- Log raw AI responses for debugging
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

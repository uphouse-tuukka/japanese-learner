# Coding Standards

Read this document before changing application code, tests, tooling, or documentation that describes implementation rules.

## Stack and structure

- Use SvelteKit 2, Svelte 5 runes syntax, and strict TypeScript.
- Keep server-only code in `src/lib/server/`.
- Put API routes under `src/routes/api/`.
- Use design tokens from `src/app.css` for UI styling.
- Keep components focused on one responsibility per file.
- Prefer flat, explicit code over speculative abstractions.
- Keep functions small to medium and avoid deep nesting.
- Use descriptive names and comments only for non-obvious invariants.

## Svelte components

- Use `$props()`, `$state()`, and `$derived()` runes.
- Use scoped `<style>` blocks per component.
- Exercise components must follow `documents/design/exercise-ui-guidelines.md`.
- That guideline owns the exercise frame, result, status, spacing, primary-button, and token contract.
- When changing exercise UI, run `npm test -- src/lib/components/exercises/exercise-ui-contract.test.ts`.

## Server and domain boundaries

- Keep Learning Session generation and summary interactions in `src/lib/server/ai.ts`.
- Keep focused AI capabilities in dedicated modules under `src/lib/server/`.
- Use the shared OpenAI client, token accounting, and sanitized logging boundaries for AI capabilities.
- Keep database initialization and shared core operations in `src/lib/server/db.ts`.
- Put focused database operations in dedicated server repositories when appropriate.

## AI prompts and logging

- Prompts that generate learner-visible Japanese must require romaji in parentheses or a paired structured romaji field.
- Speech-recognition prompts must preserve the learner's Japanese transcript without generated romaji.
- The UI pairs that transcript with authored expected-answer romaji where feedback is shown.
- Use structured JSON output where possible.
- Log only sanitized AI diagnostics such as metadata, counts, statuses, and short non-sensitive previews.
- Do not log secrets, authentication data, full prompts, raw user learning content, or complete raw AI payloads.
- Include fallback behavior when an AI call fails.

## Audio and TTS

- Prefer server TTS with OpenAI `tts-1-hd` and the `nova` voice for sentences.
- Browser TTS is acceptable for single words and short phrases.
- Use `src/lib/utils/tts.ts` for TTS and `src/lib/utils/audio.ts` for audio playback.
- Handle loading, playing, and stopped states in the UI.

## Validation

- Run `npm run validate:ci` after every change unless the task explicitly scopes validation differently.
- `npm run validate:ci` runs formatting, Svelte and TypeScript checks, linting, tests, and the production build.
- Run `npm run format:check` for documentation-only changes when applicable.
- Use `npm run validate` as the shorter local check, lint, and test shortcut when the full CI gate is not required.
- Fix validation errors before considering the work complete.

Read lint and formatting configuration in `eslint.config.js` and `.prettierrc`.
Follow the documentation workflow in `documents/CONTRIBUTING.md` when documenting implementation changes.

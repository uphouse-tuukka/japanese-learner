# Japanese Learner (SvelteKit 2 + Svelte 5 + TypeScript)

Minimal full-stack Japanese learning app with:

- user profiles
- learn sessions
- practice sessions
- progress tracking
- travel missions
- portfolio challenge
- TTS with browser + `/api/tts` server fallback

## Tech stack

- SvelteKit 2
- Svelte 5 runes syntax
- TypeScript
- Turso (`@libsql/client`)

## Setup

1. Use the pinned Node runtime and npm package manager:
   ```bash
   nvm install
   nvm use
   node --version # v24.15.0
   npm --version  # 11.12.1
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env file:
   ```bash
   cp .env.example .env
   ```
4. Fill required env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `OPENAI_API_KEY` for AI-backed learning features and server TTS).
5. Run the full validation gate:
   ```bash
   npm run validate:ci
   ```
6. Start dev server:
   ```bash
   npm run dev
   ```

## Optional CodeGraph navigation

Agents may use the repo-local CodeGraph workflow to map Svelte components, SvelteKit routes, server utilities, callers, callees, and likely impact surfaces. It is optional and local-only: no global install, Hermes/MCP config, app dependency, CI, or production integration.

```bash
npm run codegraph:preflight
npm run codegraph:init
npm run codegraph:status
npm run codegraph:sync
```

Example exact queries:

```bash
npm run codegraph:cli -- query SpeakingExercise --path .
npm run codegraph:cli -- callers checkSpeakingAnswer --path .
npm run codegraph:cli -- impact ExerciseAnswerPayload --path .
npm run codegraph:cli -- query api/missions --path .
```

Treat CodeGraph output as navigation guidance only. Read the source and run the required validation before claiming behavior is correct. See `documents/decisions/005-codegraph-repo-local-navigation.md` for guardrails.

## Environment variables

See `.env.example` for full list and comments.

Important values:

- `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD`: optional app access gate.
- `AUTH_SECRET`: optional cookie/session signing override; defaults to a derived secret from `BASIC_AUTH_PASSWORD`. Recommended for production/public deployments, especially if `BASIC_AUTH_PASSWORD` is unset or weak.
- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`: required database connection.
- `OPENAI_API_KEY`: required for AI-backed session generation, answer checking, missions, server TTS, and speaking transcription/evaluation.
- `USE_OPENAI_TTS`: set `true` to enable OpenAI-backed TTS from server-provided layout data.
- `DAILY_TOKEN_LIMIT`: per-user daily token cap; monthly token cap is derived as `DAILY_TOKEN_LIMIT * 31`.
- `MONTHLY_COST_LIMIT`: monthly USD cost value surfaced with budget data.
- `BYPASS_KEY`: optional token-limit bypass key for admin/internal testing.
- `MAX_USERS`: maximum number of user profiles.
- `PRACTICE_MODE_ENABLED`: enables/disables practice mode features.
- `MISSIONS_UNLOCK_ALL`: optional dev override to unlock all missions.
- `DISABLE_PORTFOLIO_QUOTA`: dev-only portfolio/public challenge quota bypass.
- `SESSION_GENERATION_TIMEOUT_MS`: AI session generation timeout in milliseconds (default `30000`).
- `MONTHLY_TOKEN_BUDGET`: deprecated/unused; do not set it.

## Project docs

- `AGENTS.md`: root boot guide for AI agents.
- `documents/CONTRIBUTING.md`: contribution, validation, documentation, and review workflow.
- `documents/INDEX.md`: status index for active, implemented, superseded, planning, analysis, and decision docs. Check it before following older plans.

## App routes

- `/`: Home dashboard, profile selection, and profile creation
- `/learn`: AI lesson/session generation and completion
- `/practice`: adaptive practice session generation and completion
- `/missions`: travel mission overview and unlock progress
- `/missions/[id]`: interactive mission conversation flow
- `/progress`: DB-backed progress dashboard, history, XP, streaks, and skill breakdowns
- `/portfolio/challenge`: public portfolio demo challenge session

## API routes

- `/api/auth/*`: login/logout
- `/api/user/*`: user preference and level updates
- `/api/session/*`: learn session generation/completion
- `/api/practice/*`: practice session generation/completion
- `/api/missions/*`: mission listing, start, response, and completion endpoints
- `/api/portfolio/session/*`: portfolio challenge session start/current/progress/complete endpoints
- `/api/check-answer`: answer evaluation helper
- `/api/speaking/check`: authenticated multipart speaking exercise transcription and evaluation helper
- `/api/tts`: server fallback TTS

## Architecture summary

- `src/lib/server/db.ts`: DB initialization, schema setup, migrations, query helpers, and mission seed loading
- `src/lib/server/missions-seed.ts`: current mission definition seed data
- `src/lib/components/SessionRenderer.svelte`: routes exercise rendering to the exercise components
- `src/lib/components/exercises/*`: exercise UI components with consistent `onAnswer(payload)` callback
- `src/lib/utils/tts.ts`: shared TTS utility used by `ListeningExercise.svelte`

## Token limiting

Token usage budget is enforced by server token-limiter utilities.

- Learn page reads budget status from server load.
- Daily limits are configured with `DAILY_TOKEN_LIMIT`; the monthly token budget is derived as `DAILY_TOKEN_LIMIT * 31`.

## Adding users

Use Home page:

1. Create user with display name and starting level.
2. User is stored in `users` table.
3. Selected user id is stored in cookie `selected_user`.

## Database notes

Current table groups created on startup:

- Core learning: `users`, `sessions`, `exercises`, `session_exercises`, `user_exercise_results`, `token_usage`
- XP, streaks, and milestones: `user_xp`, `user_streaks`, `user_milestones`
- Missions: `missions`, `user_missions`, `user_badges`, `user_mission_limits`
- Portfolio challenge attempts: `portfolio_challenge_attempts`

Mission definitions are seeded from `src/lib/server/missions-seed.ts` during DB initialization.

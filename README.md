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

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file:
   ```bash
   cp .env.example .env
   ```
3. Fill required env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `OPENAI_API_KEY` for AI-backed learning features and server TTS).
4. Run the full validation gate:
   ```bash
   npm run validate:ci
   ```
5. Start dev server:
   ```bash
   npm run dev
   ```

## Environment variables

See `.env.example` for full list and comments.

Important values:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `DAILY_TOKEN_LIMIT`
- `MAX_USERS`

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
- `/api/tts`: server fallback TTS

## Architecture summary

- `src/lib/server/db.ts`: DB initialization, schema setup, migrations, query helpers, and mission seed loading
- `src/lib/server/missions-seed.ts`: current mission definition seed data
- `src/lib/components/SessionRenderer.svelte`: routes exercise rendering to 6 exercise components
- `src/lib/components/exercises/*`: exercise UI components with consistent `onAnswer(payload)` callback
- `src/lib/utils/tts.ts`: shared TTS utility used by `ListeningExercise.svelte`

## Token limiting

Token usage budget is enforced by server token-limiter utilities.

- Learn page reads budget status from server load.
- Daily limits and monthly budget are configured in env vars.

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

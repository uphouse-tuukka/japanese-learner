# Japanese Learner (SvelteKit 2 + Svelte 5 + TypeScript)

Minimal full-stack Japanese learning app with:

- user profiles
- learn sessions
- practice sessions
- session history
- DB-backed seed exercises
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
3. Fill required env vars (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `OPENAI_API_KEY` if you use TTS).
4. Run checks:
   ```bash
   npm run check
   npm run build
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

## App routes

- `/` Home: profile selection + profile creation, first-visit seed loading
- `/learn`: generates and completes AI mode sessions via API
- `/practice`: generates and completes practice sessions via API
- `/history`: session history from DB

## API routes

- `POST /api/session/generate`
- `POST /api/session/complete`
- `POST /api/practice/generate`
- `POST /api/practice/complete`
- `GET /api/tts` (server fallback TTS)

## Architecture summary

- `src/lib/server/db.ts`: DB initialization and query helpers
- `src/lib/server/seed.ts`: loads `src/lib/data/seed-exercises.json` into DB
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
3. Selected user id is stored in cookie `selected_user_id`.

## Database notes

Tables created on startup:

- `users`
- `sessions`
- `exercises`
- `session_exercises`
- `user_exercise_results`
- `token_usage`

Seed exercises are loaded once when first visiting Home (if no seed rows exist).

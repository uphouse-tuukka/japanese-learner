# Spoken Missions

**Last updated:** 2026-07-14

Spoken Missions let a learner complete a server-authored Can-do by voice inside an existing Travel Mission scenario.
They are additive to Written Missions and do not change Written Mission modes, completion, XP, badges, streaks, or resume storage.
The first production configuration is available only for Order at a Restaurant.

## Product model

The Travel Mission catalog continues to contain one node per real-world scenario.
A scenario with a Spoken Mission configuration gains a microphone capability mark and a mission-type chooser after the existing unlock check succeeds.
Scenarios without a Spoken Mission configuration continue directly to the existing Written Mission setup.

A Spoken Mission attempt has three ordered goals.
The restaurant Can-do uses Order, Respond, and Repair.
Each goal advances only after an Accepted assessment, while Retry and Could not assess keep the learner on the same goal.

## API contracts

All Spoken Mission endpoints are profile scoped under `/api/missions/[id]/spoken/`.
They enforce the selected-user boundary, user and mission existence, the existing mission unlock rule, server-owned configuration, attempt ownership, mission and definition matches, and current attempt state before changing evidence.

### Start or resume

`POST /api/missions/[id]/spoken/start` accepts JSON with `userId` and optional boolean `startOver`.
Without `startOver`, the endpoint resumes the newest matching in-progress attempt when one exists.
With `startOver`, it atomically abandons the current in-progress attempt and creates a replacement without deleting completed evidence.
The response contains the attempt id, learner-safe briefing, current authored server turn, restored transcript and assessment history, support-used state, and total turn count.

### Reveal listening support

`POST /api/missions/[id]/spoken/support` accepts JSON with `userId`, `attemptId`, and `turnNumber`.
The endpoint marks English listening support as used before returning the current turn's server-authored English text.
The support-used flag is monotonic for the attempt.
Replaying Japanese audio, reading Japanese or romaji, and using a Japanese repair strategy do not call this endpoint and do not count as English support.

### Assess a turn

`POST /api/missions/[id]/spoken/turn` accepts multipart form data with `userId`, `attemptId`, `turnNumber`, `clientResponseId`, `supportRevealed`, and one `audio` file.
The server loads the goal, alternatives, rubric, evidence rules, and authored NPC line from its own definition.
The browser never supplies expected answers or grading rules.
The `clientResponseId` makes a repeated submission idempotent by returning the stored assessment instead of recording or advancing twice.
The response contains the assessment, the next turn after an Accepted result, completion state, and the final result when the third goal completes.
Recoverable failures include a `recovery` value that tells the client whether it can retry the same upload or must record again.

## Persistence and resume

Spoken attempts are stored separately from Written Missions in `user_spoken_missions`.
Each row records the attempt id, user id, existing mission id, definition version, status, current turn, support-used flag, successful-turn count, wording variant, structured conversation log, evidence state, completion time, and timestamps.
Attempt status is `in_progress`, `completed`, or `abandoned`.
The structured conversation log stores authored Japanese and romaji, learner transcript, outcome, confidence, learner-facing feedback, support usage, client response id, and assessment time.

The mission detail loader exposes only the selected profile's newest resumable attempt metadata and best completed evidence.
The start response restores the full learner-safe conversation history for that attempt.
Raw audio is not part of database state, API responses, or browser resume storage.

## Evidence semantics

Untried is derived when no completed spoken attempt exists.
Independent means all three goals were Accepted without revealing English listening support.
Supported means all three goals were Accepted after English listening support was revealed on at least one turn.
The displayed best evidence is ordered Independent above Supported above Untried, so a later Supported attempt cannot downgrade an earlier Independent result.

Spoken evidence and Written Mission completion remain separate.
A Spoken Mission result is task evidence for the configured Can-do only and does not award XP, badges, category mastery, streak credit, Written Mission completion, or a global readiness claim.

## Privacy and service boundaries

The browser requests microphone permission only after an explicit Record action.
Each short recording exists transiently in browser memory, is sent to the turn endpoint for validation and Japanese transcription, and is passed to semantic assessment.
The server discards the raw audio after the request and never writes it to the database, object storage, logs, diagnostics, API responses, or browser storage.
Only the transcript and structured assessment needed for evidence and resume are retained.

Voice-assessment logs contain sanitized operational metadata only.
They do not contain raw audio, complete learner content, secrets, full prompts, or complete provider payloads.
Transcription and assessment reuse the existing per-user AI budget and token-accounting boundaries.

## Enabling another existing scenario

Add a `SpokenMissionDefinition` in `src/lib/server/spoken-missions.ts` using the id of an existing mission from `src/lib/server/missions-seed.ts`.
Do not create a duplicate mission record, catalog node, collection, track, shelf, or navigation route.

The definition must include a new immutable version, Can-do statement, briefing and privacy copy, approximate duration, maximum recording duration, exactly three ordered goals, authored Japanese and romaji server-line variants, English listening-support text, natural alternatives, semantic rubrics, and a suggested practice phrase.
Each goal should provide a line for every supported wording variant because one variant index is selected for the whole attempt.
Changing evidence-relevant content requires a new definition version so an incompatible saved attempt is rejected and can be restarted safely.

Add definition, route-flow, loader, privacy, resume, idempotency, evidence, and learner-visible UI coverage for the scenario.
Run the focused Spoken Mission tests while iterating and finish with `npm run validate:ci`.

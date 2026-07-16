# Documentation Index

**Last updated:** 2026-07-15

Use this index before following older plans or decisions. Status labels are conservative:

- **active** — current guide or source of truth for ongoing work.
- **implemented** — historical plan that appears to have been built; use code as source of truth.
- **superseded** — older plan replaced by a newer document or implementation direction.
- **planning** — proposed or roadmap work; do not assume it is implemented.
- **analysis** — research/comparison document, not an implementation spec.
- **decision** — architectural or tooling decision record.

## High-risk docs and root overview

### `documents/portfolio-challenge-capsule.md`

- Status: superseded
- Description: Historical V1 one-shot portfolio challenge capsule plan. Current portfolio work should start from the V2 mini-session doc and current code instead.
- Source files affected: `src/routes/portfolio/challenge/+page.svelte`, old `/api/portfolio/challenge/*` endpoints, `src/lib/server/portfolio-challenge.ts`
- Last verified: 2026-05-06

### `documents/public-challenge-v2.md`

- Status: active
- Description: Active public portfolio mini-session direction: anonymous scenario picker, lesson, four exercises, and summary flow.
- Source files affected: `src/routes/portfolio/challenge/+page.svelte`, `src/routes/api/portfolio/session/**`, `src/lib/server/portfolio-challenge.ts`
- Last verified: 2026-05-06

### `documents/plans/ai-session-guidelines.md`

- Status: active
- Description: Prompt/content quality guidance for AI-generated learning sessions, including Learn-cycle topic category order and Travel Essentials rails.
- Source files affected: `src/lib/server/ai-session-prompts.ts`, `src/lib/server/topic-categories.ts`, `src/lib/server/session-coverage-evidence.ts`, `src/lib/server/ai.ts`, `src/routes/api/session/**`
- Last verified: 2026-07-02

### `documents/plans/inline-audio-tts.md`

- Status: implemented
- Description: Historical plan for inline Japanese audio buttons and rich Japanese text rendering.
- Source files affected: `src/lib/utils/japanese.ts`, `src/lib/components/InlineAudio.svelte`, `src/lib/components/RichJapaneseText.svelte`, exercise components, `src/lib/components/SessionSummary.svelte`
- Last verified: 2026-05-06

### `documents/plans/progress-page-roadmap.md`

- Status: planning
- Description: Future roadmap for richer `/progress` analytics and visualizations; the current progress route exists but this doc should not be treated as fully implemented.
- Source files affected: `src/routes/progress/+page.svelte`, `src/routes/progress/+page.server.ts`, progress/gamification data utilities
- Last verified: 2026-05-06

## Active guides and workflow documents

### `README.md`

- Status: active
- Description: Current project overview, setup, route/API summary, session completion/resume behavior, optional repo-local CodeGraph navigation, and database notes.
- Source files affected: `.env.example`, `package.json`, `src/routes/**`, `src/lib/server/**`, `src/lib/stores/**`, CodeGraph workflow docs
- Last verified: 2026-07-06

### `AGENTS.md`

- Status: active
- Description: Root bootstrap document for AI agents: mission, mandatory reading, boot sequence, optional CodeGraph navigation, validation, and subagent workflow.
- Source files affected: repository workflow and validation docs
- Last verified: 2026-05-26

### `documents/CONTRIBUTING.md`

- Status: active
- Description: Project contribution guide for code quality, docs rules, repo-local CodeGraph navigation, agent workflow, review gates, session completion data flow, and architecture notes.
- Source files affected: repository workflow and validation docs
- Last verified: 2026-07-06

### `documents/INDEX.md`

- Status: active
- Description: This documentation index and status-label guide for agents.
- Source files affected: documentation only
- Last verified: 2026-05-06

### `documents/spoken-missions.md`

- Status: active
- Description: Production guide for Spoken Mission product boundaries, API contracts, attempt persistence, evidence semantics, raw-audio privacy, and enabling another existing scenario.
- Source files affected: `src/lib/server/spoken-missions.ts`, `src/lib/server/spoken-missions-db.ts`, `src/routes/api/missions/[id]/spoken/**`, `src/routes/missions/[id]/**`, `src/lib/components/missions/SpokenMission*.svelte`
- Last verified: 2026-07-16

### `documents/templates/plan-template.md`

- Status: active
- Description: Reusable template for implementation plans.
- Source files affected: documentation only
- Last verified: 2026-05-06

### `documents/templates/decision-template.md`

- Status: active
- Description: Reusable template for decision records.
- Source files affected: documentation only
- Last verified: 2026-05-06

### `documents/templates/review-template.md`

- Status: active
- Description: Reusable template for spec, quality, security/privacy, and validation reviews.
- Source files affected: documentation only
- Last verified: 2026-05-06

### `documents/reviews/2026-07-15-spoken-mission-browser-acceptance.md`

- Status: active
- Description: Browser acceptance evidence for Spoken Missions covering desktop and mobile layout, real microphone capture, live semantic grading, evidence labels, resume, recovery, accessibility, privacy, and recorded limitations.
- Source files affected: `src/routes/missions/[id]/**`, `src/lib/components/missions/**`, `src/lib/utils/audio-recorder.ts`, Spoken Mission APIs and persistence
- Last verified: 2026-07-15

### `documents/design/exercise-ui-guidelines.md`

- Status: active
- Description: Shared exercise UI contract for frame ownership, shared frame/result/status primitives, spacing, buttons, result/status treatment, token hygiene, and the Vitest guardrail command.
- Source files affected: `src/app.css`, `src/lib/components/SessionRenderer.svelte`, `src/lib/components/exercises/**`, exercise route framing
- Last verified: 2026-05-20

## Plans

### `documents/plans/2026-06-08-session-summary-experiment-brief.md`

- Status: active
- Description: Experiment Lab decision brief for the session summary redesign; locks B4 as the prototype direction and records the no-duplicate-feedback, carry-forward summary principles.
- Source files affected: `src/lib/components/SessionSummary.svelte`, `src/lib/components/session-summary-view-model.ts`, `src/routes/prototype/session-summary/+page.svelte`, session summary AI/view-model wiring
- Last verified: 2026-06-08

### `documents/plans/2026-06-05-progress-level-ink-separation.md`

- Status: implemented
- Description: Implemented cleanup separating learning/profile level from ink/XP progress on the `/progress` analytics branch, including Level Journey copy/model cleanup and roadmap corrections.
- Source files affected: `src/routes/progress/+page.svelte`, `src/routes/progress/progress-view-model.ts`, `src/routes/progress/progress-view-model.test.ts`, `documents/plans/progress-page-roadmap.md`
- Last verified: 2026-06-05

### `documents/plans/2026-05-26-learning-session-core-cycle.md`

- Status: implemented
- Description: Implemented Learning Session Coverage Evidence/core-cycle plan for deterministic category rails, review candidates, learning journal prompt context, and curriculum validation.
- Source files affected: `src/routes/api/session/generate/+server.ts`, `src/routes/api/session/complete/+server.ts`, `src/lib/server/session-coverage-evidence.ts`, `src/lib/server/session-curriculum-validation.ts`, `src/lib/server/ai-session-prompts.ts`, `src/lib/server/topic-categories.ts`, session route tests
- Last verified: 2026-07-02

### `documents/plans/2026-05-06-technical-debt-agentic-workflow-improvements.md`

- Status: implemented
- Description: Broad internal technical-debt plan implemented through final Phase 10 portfolio challenge view-model helper extraction and Phase 11 documentation closure; use current code and active guides as source of truth for future work.
- Source files affected: docs/workflow, tooling/CI, shared validators/helpers, DB internals, AI internals, API/profile boundaries, background tasks, and UI modularization including `src/routes/learn/session-storage.ts`, `src/routes/missions/[id]/mission-storage.ts`, `src/routes/progress/progress-view-model.ts`, `src/lib/components/session-summary-view-model.ts`, `src/lib/components/exercises/translation-exercise-view-model.ts`, and `src/routes/portfolio/challenge/portfolio-challenge-view-model.ts`
- Last verified: 2026-05-09

### `documents/plans/2026-03-27-travel-missions-design.md`

- Status: implemented
- Description: Historical Travel Missions design spec for mission catalog, mission chat, badges, limits, and mission APIs.
- Source files affected: `src/routes/missions/**`, `src/routes/api/missions/**`, `src/lib/server/missions-*.ts`, mission tables in DB setup
- Last verified: 2026-07-02

### `documents/plans/2026-03-27-ai-tutor-improvements-design.md`

- Status: implemented
- Description: Historical AI tutor improvement plan for category rotation, summary bridge fields, and topic tracking, currentized with the Travel Essentials category order.
- Source files affected: `src/lib/server/ai.ts`, `src/routes/api/session/generate/+server.ts`, `src/routes/api/session/complete/+server.ts`, `src/routes/learn/+page.svelte`, `src/lib/types.ts`, `src/lib/components/SessionSummary.svelte`
- Last verified: 2026-07-02

### `documents/plans/feature-roadmap.md`

- Status: planning
- Description: Strategic roadmap for travel readiness features: habit loop, missions, and speaking coach. Use only as product strategy context.
- Source files affected: broad future app surfaces; specific files vary by phase
- Last verified: Unknown

## Decisions

### `documents/decisions/001-ai-model-selection.md`

- Status: decision
- Description: Historical decision to upgrade AI session generation to `gpt-4.1`; current code should be checked because model constants have changed since this decision.
- Source files affected: `src/lib/server/ai.ts`, `src/lib/server/answer-checker.ts`, `src/lib/server/missions-ai.ts`
- Last verified: 2026-05-06

### `documents/decisions/002-inline-audio-approach.md`

- Status: decision
- Description: Decision record for hybrid inline audio: structured exercise data plus Japanese text auto-detection.
- Source files affected: `src/lib/utils/japanese.ts`, `src/lib/components/InlineAudio.svelte`, `src/lib/components/RichJapaneseText.svelte`, TTS utilities, exercise components
- Last verified: 2026-05-06

### `documents/decisions/003-selected-user-api-boundary.md`

- Status: decision
- Description: Decision record for enforcing present `selected_user` cookies against body `userId` on migrated profile-scoped write APIs while allowing absent cookies for compatibility.
- Source files affected: `src/lib/server/selected-user.ts`, migrated profile-scoped write routes under `src/routes/api/**`
- Last verified: 2026-05-07

### `documents/decisions/004-mission-db-constraints.md`

- Status: decision
- Description: Decision record for leaving mission table FK/index conventions unchanged until a future orphan audit and SQLite/libsql table-rebuild migration plan justify DB-level enforcement.
- Source files affected: `src/lib/server/db-schema.ts`, `src/lib/server/db-migrations.ts`, mission-related DB access in `src/lib/server/missions-db.ts`
- Last verified: 2026-05-08

### `documents/decisions/005-codegraph-repo-local-navigation.md`

- Status: decision
- Description: Decision record for optional repo-local CodeGraph navigation via pinned npm-exec scripts, ignored `.codegraph/`, and a symlink/source-boundary preflight.
- Source files affected: `.gitignore`, `package.json`, `scripts/codegraph-preflight.mjs`, `AGENTS.md`, `documents/CONTRIBUTING.md`, `README.md`
- Last verified: 2026-05-26

## Analyses

### `documents/analyses/ai-model-comparison.md`

- Status: analysis
- Description: Historical model comparison that supported the `gpt-4.1` decision; use current code and provider availability for live model choices.
- Source files affected: `src/lib/server/ai.ts`, AI model constants and prompt code
- Last verified: 2026-05-06

## Missing external spec path

- `docs/superpowers/specs/`: no entries. Verified on 2026-05-06 that this path does not exist in the repository.

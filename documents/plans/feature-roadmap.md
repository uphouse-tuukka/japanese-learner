# Japanese Learner Strategic Feature Roadmap

**Date:** 2026-03-20  
**Scope:** Strategic roadmap for post-MVP feature development aligned to Japan trip readiness  
**Current stack constraints:** SvelteKit 2, Svelte 5, TypeScript, Turso SQLite, OpenAI, Vercel

## 1. Current State Assessment

### What the app already does well

- **Strong core learning loop exists:** generate session -> complete exercises -> get feedback -> revisit in practice mode.
- **Travel-relevant content foundation exists:** AI session guidelines already prioritize practical language and topic variety.
- **Exercise diversity is solid for early-to-mid proficiency:** six exercise types cover recognition, recall, grammar ordering, reading, and listening.
- **Useful personalization primitives already exist:** user levels, weakness-aware practice, session summaries, and per-exercise correctness data.
- **Operational guardrails are mature for a personal app:** token usage tracking, daily budget constraints, and deterministic JSON-first AI generation.

### What is missing relative to the Japan-trip outcome

- **No explicit trip scenarios as product surface:** content may be travel-themed, but there is no visible structure for “I need train station Japanese today.”
- **No habit mechanic to sustain daily momentum:** no streaks, no daily goals, no “come back tomorrow” trigger.
- **No speaking confidence loop:** listening exists, but there is no pronunciation practice, spoken recall, or speaking feedback.
- **No medium-term progression map:** users can do sessions, but cannot see “how close am I to trip readiness by mission/category.”

### Core strategic gap

Current app strength: **AI-generated lesson quality**.  
Missing layer: **goal-directed behavior design** (habit + scenario mastery + speaking confidence).  
Roadmap should add this layer without destabilizing the existing session engine.

---

## 2. Deep Analysis of the Three Options

## Option 1: Travel Missions

### What it is

Scenario-based learning paths tied to real trip moments:

- Food
- Transport
- Hotel
- Shopping
- Directions
- Emergency

Each mission bundles focused mini-sessions and scenario-specific exercises.

### Pros

- **Highest alignment with trip objective:** immediate practical transfer to real Japan situations.
- **Clear product differentiation:** unlike generic language apps, this is personalized mission prep for a specific traveler.
- **Improves motivation naturally:** users see direct utility (“I can now order ramen confidently”).
- **Fits existing architecture well:** can reuse current session/exercise pipeline with mission context metadata.

### Cons

- Requires stronger content controls to avoid repetitive scenario outputs.
- More product design work (mission map, completion criteria, per-mission progress model).
- Potential scope creep if too many missions launch at once.

### Technical complexity

- **Medium.**
- Main work is schema extension + prompt design + mission progress UI.
- Does not require fundamentally new platform capabilities.

### Estimated effort (for personal project)

- **MVP mission system:** 1.5-2.5 weeks
- **Polished mission experience:** +1-2 weeks

### Strategic rating

- **Trip alignment:** 10/10
- **Differentiation:** 9/10
- **Technical risk:** 4/10
- **Time-to-value:** 8/10

---

## Option 2: Speaking-First Coach

### What it is

Pronunciation and spoken recall drills:

- repeat-after-audio (shadowing)
- phrase recall out loud
- optional pronunciation confidence feedback

### Pros

- **Directly solves confidence problem before travel.**
- Potentially the most emotionally rewarding feature (“I can say this out loud”).
- Complements existing listening and translation exercises.

### Cons

- Requires speech recognition integration and audio UX iteration.
- Browser/device variability (mic permissions, noisy environments, mobile differences).
- Risk of inaccurate feedback demotivating beginners.

### Technical complexity

- **High.**
- New capture/stream/transcription workflow, additional latency/error states, and potentially higher API costs.

### Estimated effort

- **MVP speech loop:** 2-4 weeks
- **Reliable scoring + UX polish:** +2-4 weeks

### Strategic rating

- **Trip alignment:** 8/10
- **Differentiation:** 8/10
- **Technical risk:** 8/10
- **Time-to-value:** 5/10

---

## Option 3: Habit Loop + Progression

### What it is

Behavioral scaffolding for consistency:

- daily streaks
- lightweight daily goal
- visible progress layer (later extend to weekly goals and paths)

### Pros

- **Fastest engagement boost with low engineering cost.**
- Increases retention and frequency, making every other roadmap feature more effective.
- Simple to integrate into current home/learn/practice surfaces.

### Cons

- Alone, it does not improve real-world speaking/travel readiness deeply.
- Can feel generic if not connected to travel context.

### Technical complexity

- **Low to medium.**
- Mostly DB additions, simple calculations, and UI status components.

### Estimated effort

- **MVP (streak + single daily goal):** 3-5 days
- **Full progression layer:** +1-2 weeks

### Strategic rating

- **Trip alignment:** 6/10
- **Differentiation:** 5/10
- **Technical risk:** 3/10
- **Time-to-value:** 9/10

---

## Comparative summary

- If you optimize for **immediate practical trip readiness**, choose **Travel Missions** as the core direction.
- If you optimize for **behavioral consistency first**, start with **Habit Loop**.
- If you optimize for **confidence and advanced UX**, build **Speaking Coach** after mission context exists.

**Best strategic sequence:** Habit Loop -> Travel Missions -> Speaking Coach.

---

## 3. Recommended Phased Roadmap

## Phase 1 (Quick Wins): Habit Loop Basics

**Goal:** Increase daily consistency and app return rate within 1 week.

Deliver:

- `daily_streak` tracking
- one simple daily goal (“Complete 1 session today”)
- streak-aware encouragement in AI summary/prompts

Success metrics:

- 7-day active usage rate increases
- median sessions/user/week increases
- streak distribution forms (users with 3+ day streak)

## Phase 2 (Core Differentiator): Travel Missions

**Goal:** Make the app explicitly trip-oriented with scenario mastery.

Deliver:

- 5-8 mission paths (start with 6 core categories)
- mission-aware AI generation prompts
- per-mission progress tracking and completion states
- at least 1 new dialogue-style exercise type

Success metrics:

- mission start rate
- mission completion rate
- self-reported confidence by mission category

## Phase 3 (Advanced): Speaking Coach in Mission Context

**Goal:** Build spoken confidence where it matters (inside travel missions).

Deliver:

- pronunciation/shadowing drills tied to mission phrases
- speech transcription pipeline
- feedback UX with graceful fallback when confidence is low

Success metrics:

- speaking drill completion rate
- repeated drill usage
- subjective confidence uplift before trip

---

## 4. Phase 1 Detail (Concrete)

## 4.1 Daily streak tracking

### DB schema additions

```sql
CREATE TABLE IF NOT EXISTS user_habits (
  user_id TEXT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date TEXT,
  goal_type TEXT NOT NULL DEFAULT 'session_count',
  goal_target INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_daily_activity (
  user_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  practice_completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, activity_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user_date
  ON user_daily_activity(user_id, activity_date);
```

Notes:

- Store `activity_date` as local date string (`YYYY-MM-DD`) derived in server logic.
- Update streak only when a qualifying daily action is completed.

### Streak logic (server)

- On session completion:
  - upsert `user_daily_activity`
  - if first qualifying activity for that day, evaluate streak transition:
    - if `last_activity_date = yesterday`: `current_streak += 1`
    - if `last_activity_date = today`: no streak change
    - else: `current_streak = 1`
  - update `longest_streak = max(longest_streak, current_streak)`
  - update `last_activity_date`

## 4.2 Simple daily goals

### Goal definition (Phase 1 scope)

- Single default goal: `session_count >= 1 per day`
- Optional mode split for display only:
  - Learn goal complete if learn or practice session completed (keep logic simple)

### UI component proposal

- New component: `HabitCard.svelte`
- Placement:
  - top of Home page and Learn page
- Data shown:
  - current streak (`N days`)
  - today status (`0/1 session`)
  - micro-encouragement line

### Text UI sketch

```text
+---------------------------------------------+
| 🔥 Streak: 4 days                           |
| Today: 0/1 sessions                         |
| Complete one lesson to keep your streak.    |
| [Start Learn Session]                       |
+---------------------------------------------+
```

## 4.3 Streak-aware AI prompting

### Prompt integration points

- Session generation prompt: add optional short motivational line requirement.
- Session summary prompt: include habit context variables.

### New prompt variables

- `current_streak`
- `longest_streak`
- `daily_goal_complete` (boolean)

### Behavior requirement

- AI encouragement should be short and specific, not generic gamification language.
- Example:
  - “Nice work keeping a 4-day streak. Tomorrow, review station phrases for your transport mission.”

---

## 5. Phase 2 Detail (Travel Missions)

## 5.1 Mission categories (initial set)

1. Food & restaurants
2. Transport & stations
3. Hotel & check-in
4. Shopping & payments
5. Directions & navigation
6. Emergency & help

Optional expansion:

- Convenience store routines
- Social small talk

## 5.2 Data model additions

```sql
CREATE TABLE IF NOT EXISTS missions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mission_steps (
  id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  title TEXT NOT NULL,
  difficulty_target INTEGER NOT NULL,
  objective TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (mission_id, step_key),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE IF NOT EXISTS user_mission_progress (
  user_id TEXT NOT NULL,
  mission_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  completion_percent INTEGER NOT NULL DEFAULT 0,
  last_step_key TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, mission_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

ALTER TABLE sessions ADD COLUMN mission_id TEXT;
ALTER TABLE sessions ADD COLUMN mission_step_key TEXT;
```

## 5.3 AI prompt changes per scenario

Add mission context block into generation payload:

- `mission_slug`
- `mission_step`
- `must_include_phrases` (2-5 target phrases)
- `avoid_recent_phrases` (from user history)
- `situation_goal` (e.g., “ask platform number and confirm destination”)

Prompt behavior:

- lesson explanation and all exercises must stay within mission context.
- include pragmatic variants (formal + polite casual where appropriate).
- keep role intent explicit (traveler vs local staff).

## 5.4 Mission progress behavior

Progress updates from observable outcomes:

- session completed in mission context
- accuracy threshold met (e.g., >= 70%)
- key phrase recall performance on mission-tagged exercises

Phase 2 simple rule:

- each completed mission step = +`(100 / step_count)` percent
- lock next step until current step completion condition is met

## 5.5 New exercise possibilities

### A) `dialogue_choice`

- User picks best response for a dialogue turn.
- Useful for politeness and context-appropriate phrasing.

Example structure:

- prompt: “Hotel staff asks for your passport.”
- choices include natural and unnatural responses
- explanation for why correct option fits context

### B) `roleplay_response`

- User writes or speaks one-turn response in a scenario.
- AI checks meaning adequacy + politeness + key phrase use.
- Initially text-only (Phase 2), add speech input in Phase 3.

### Mission screen text UI sketch

```text
Travel Missions

[Food]        40%  • In progress
[Transport]   20%  • In progress
[Hotel]        0%  • Not started
[Shopping]     0%  • Not started
[Directions]   0%  • Not started
[Emergency]    0%  • Not started

Selected: Transport
Step 2: Buying a ticket at a machine
Objective: Ask for destination and fare confirmation.
[Start Mission Session]
```

---

## 6. Phase 3 Brief (Speaking Coach)

## What to build

- Mission-tied speaking drills:
  - shadow phrase
  - repeat with variation
  - say the right phrase for a prompt

## Technical requirements

Frontend:

- microphone capture and permission UX
- waveform/record state indicator
- retry and “skip speaking” fallback

Speech recognition/transcription options:

- **Web Speech API**
  - pros: low latency, no server cost for transcription
  - cons: browser inconsistency, limited control and quality variability
- **Server transcription via OpenAI audio transcription models (including Whisper family / gpt-4o transcribe variants)**
  - pros: more consistent quality and controllable pipeline
  - cons: added latency + token/cost overhead

Recommended Phase 3 approach:

- start with **server transcription path** for consistency
- optionally enable Web Speech API as fast fallback where supported

## Risks

- perceived unfair grading due to accent/noise
- mobile Safari/permission friction
- longer response times hurting flow
- increased operational cost per speaking drill

Mitigations:

- confidence threshold with soft feedback (“probably correct”)
- always show expected phrase and allow manual self-check
- degrade gracefully to text mode when mic/transcription fails

---

## 7. Dependencies and Decision Points

## Before Phase 1 starts

Dependencies:

- agree on what counts toward streak (learn only vs learn+practice)
- local-time handling policy for day boundaries

Decision points:

- should missed day reset to 0 or 1 after next completion (recommended: reset then next day starts at 1)

## Before Phase 2 starts

Dependencies:

- Phase 1 event tracking stable (daily activity data reliable)
- mission taxonomy and step definitions finalized
- prompt template supports mission context inputs

Decision points:

- mission completion rule: step-count based vs accuracy-gated hybrid
- whether mission progress is linear or free-select

## Before Phase 3 starts

Dependencies:

- mission exercises stable enough to embed speaking moments
- baseline mission analytics available (to compare speaking impact)
- accepted latency budget for speaking flow decided

Decision points:

- primary transcription stack: OpenAI-only vs hybrid with Web Speech API
- feedback strictness: binary grading vs guidance-first scoring

---

## Why this roadmap wins for this product

Duolingo optimizes breadth and streak gamification. Anki optimizes spaced repetition.  
This app can own a different space: **AI-personalized, trip-specific readiness**.

The sequence in this roadmap preserves momentum:

- Phase 1 increases consistency quickly.
- Phase 2 creates the signature value for Japan travel.
- Phase 3 adds confidence-building depth once mission contexts are stable.

That order minimizes technical risk while maximizing practical outcome before the trip.

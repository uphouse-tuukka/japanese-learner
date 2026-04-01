# Travel Missions — Design Spec

## Overview

Travel Missions is a new feature that adds immersive RPG-style roleplay conversations to the Japanese learning app. Each mission places the user in a real-world scenario (ordering food, checking into a hotel, asking for directions) where an AI character interacts with them entirely in Japanese. This is a separate feature from the core Learn loop — a new `/missions` page with its own progression system.

## Goals

- Give learners a practical application for what they've studied in Learn sessions
- Create dopamine-driven motivation through badges, XP, and unlockable content
- Provide an immersive "you're actually in Japan" experience within the app's existing warm aesthetic
- Offer two difficulty tiers: guided Practice Mode (safe, with hints) and free-type Immersion Mode (challenging, with rewards)

## Design Principles

- **Same app, special moment**: Missions use the app's existing warm paper palette (shoji, washi, vermillion, matcha). The immersive feeling comes from storytelling and conversation flow, not a visual departure.
- **Japanese-only AI dialogue**: The AI character speaks only Japanese + romaji. No English translations in their lines. This is the core challenge.
- **Rewards gate behind effort**: Badges and full XP are only earned in Immersion Mode (free-type). Practice Mode (multiple choice) is a safe learning space with reduced XP and no badge unlocks.
- **Backwards compatible**: Missions are additive. The core Learn loop, XP system, streaks, and milestones are untouched.

---

## Feature: Mission Catalog & Progression

### Missions Page (`/missions`)

A dedicated page showing all available missions organized by category with linear progression tracks.

**Layout:**

- Page header with overall mission progress (e.g., "3/10 missions completed")
- Category sections, each containing a horizontal progression track
- Each track shows mission nodes connected by lines, ending with a category mastery badge

**Mission node states:**

- **Available** (unlocked, not yet completed): White fill, gold border, subtle glow
- **Completed**: Light green fill, green border, checkmark overlay
- **Locked**: Gray fill, gray border, reduced opacity, lock icon overlay

**Category mastery badge:** Appears at the end of each track. Gold gradient when all missions in the category are completed in Immersion Mode; grayed out otherwise.

### Mission Definitions (MVP — 10 missions)

| #   | Mission               | Category Key          | Difficulty | Unlock Requirement                      |
| --- | --------------------- | --------------------- | ---------- | --------------------------------------- |
| 1   | First Meeting         | `greetings_basics`    | Easy       | Start unlocked                          |
| 2   | Ask for Help          | `greetings_basics`    | Easy       | Start unlocked                          |
| 3   | Order at a Restaurant | `food_dining`         | Medium     | 2 Learn sessions in food_dining         |
| 4   | Street Food Stand     | `food_dining`         | Medium     | 2 Learn sessions in food_dining         |
| 5   | Buy a Train Ticket    | `transport`           | Medium     | 2 Learn sessions in transport           |
| 6   | Hotel Check-in        | `hotel_accommodation` | Medium     | 2 Learn sessions in hotel_accommodation |
| 7   | Convenience Store Run | `shopping`            | Medium     | 2 Learn sessions in shopping            |
| 8   | Izakaya Night         | `bars_nightlife`      | Hard       | 2 Learn sessions in bars_nightlife      |
| 9   | Bar Conversation      | `bars_nightlife`      | Hard       | 3 Learn sessions in bars_nightlife      |
| 10  | Lost & Found          | `emergencies_health`  | Hard       | 2 Learn sessions in emergencies_health  |

**Unlock logic:**

- Missions 1 and 2 are always available (starter missions)
- Other missions require N completed Learn sessions in the matching `TOPIC_CATEGORIES` category (the category field stored in `SessionMeta`)
- A dev override (environment variable or setting) force-unlocks all missions for debugging

**Replay:** Users can replay any completed mission at any time. Re-completing in Immersion Mode does not re-grant the badge but still awards XP.

---

## Feature: Mission Chat UI

### Conversation Flow

Each mission consists of 4-5 exchanges (turns). Each turn:

1. AI character speaks (Japanese + romaji only)
2. User responds (multiple choice in Practice Mode, free-type in Immersion Mode)
3. Feedback is shown (correct/natural/try again)
4. Next turn begins

### Layout (top to bottom)

**Mission Header (sticky):**

- Back button, mission title with emoji, progress dots (N of 5)
- Mode banner below: "📖 Practice Mode" with link to switch, or "🏆 Immersion Mode — Badges & XP earned here"

**Scene Introduction Card:**

- White card with thin vermillion top border
- Atmospheric italic text setting the scene (e.g., "You've been seated at a cozy ramen shop in Shinjuku...")
- Appears once at the start of the mission

**Conversation Thread:**

- Vertical thread connector line on the left linking all turns
- Completed turns shown compactly: character avatar + Japanese + romaji + user's response + feedback checkmark
- Current turn shown prominently: elevated white card with vermillion left border, larger text, audio play button

**Character Identity:**

- Each AI character has a role label (e.g., 🧑‍🍳 ウェイター) and a small circular avatar
- Avatar styling changes for current turn (vermillion wash background) vs completed turns (neutral background)

### Response Modes

**Practice Mode (Multiple Choice):**

- 3 response options per turn, stacked vertically
- Each option shows: Japanese text, romaji below, English meaning below that (column layout)
- Hover: vermillion wash background, left border accent
- Selecting an option submits the response

**Immersion Mode (Free-type):**

- Text input field with placeholder "Type your response in Japanese..."
- "💡 Show hint" toggle that reveals a contextual English hint (e.g., "They're asking if you've decided on your order")
- "Send →" vermillion pill button
- No English anywhere in the AI's dialogue or the input area (except the optional hint)

**Critical rule: AI character text is Japanese + romaji only. Zero English. This applies in both modes.**

### Audio

- Each AI character line has an audio play button (SVG speaker icon in a small pill button)
- Styled consistently with the app's design tokens (not emoji)

---

## Feature: Mission Completion

### Completion Screen

Shown after the final exchange. Two variants based on mode:

**Immersion Mode (earned badge):**

- Success banner: matcha wash background, 🎉 emoji, "Mission Complete!"
- Stats row: exchanges, correct responses, score percentage
- XP breakdown card (washi background):
  - Mission completion: +100 XP
  - Correct responses: +10 XP each
  - Natural phrasing bonus: +15 XP (if applicable)
  - Total in vermillion
- Badge earned card (gold wash background, gold border, subtle glow):
  - Mission-specific emoji + badge name (e.g., 🍜 "Ramen Regular")
  - Confidence statement: "You can now order basic dishes at a Japanese restaurant!"
  - "Badge added to your profile ✓"
- Buttons: "Back to Missions" (secondary) + "Next Mission →" (primary vermillion)

**Practice Mode (locked badge):**

- Neutral banner: washi background, 📖 emoji, "Practice Complete"
- Same stats
- Reduced XP:
  - Practice completion: +25 XP
  - Correct responses: +10 XP each
  - Total (smaller than Immersion)
- Locked badge card (kinu gray background, mid border, lock icon):
  - 🔒 + mission emoji + badge name in muted text
  - "Complete in Immersion Mode to unlock this badge"
- Buttons: "Back to Missions" (secondary) + "Try in Immersion Mode →" (primary vermillion)

### Badges (MVP)

Each mission has an associated badge, earned only by completing in Immersion Mode:

| Mission               | Badge Name          | Confidence Statement                                 |
| --------------------- | ------------------- | ---------------------------------------------------- |
| First Meeting         | 🤝 Social Butterfly | You can introduce yourself in Japanese!              |
| Ask for Help          | 🙋 Helpful Traveler | You can ask for help when you need it!               |
| Order at a Restaurant | 🍜 Ramen Regular    | You can order basic dishes at a Japanese restaurant! |
| Street Food Stand     | 🍡 Street Food Pro  | You can navigate a Japanese street food stand!       |
| Buy a Train Ticket    | 🚃 Rail Rider       | You can buy train tickets and navigate stations!     |
| Hotel Check-in        | 🏨 Hotel Guest      | You can check into a Japanese hotel!                 |
| Convenience Store Run | 🏪 Konbini Master   | You can handle a convenience store transaction!      |
| Izakaya Night         | 🍶 Izakaya Regular  | You can order and socialize at an izakaya!           |
| Bar Conversation      | 🍻 Bar Buddy        | You can hold a casual conversation at a bar!         |
| Lost & Found          | 🔍 Problem Solver   | You can handle unexpected situations in Japanese!    |

### Category Mastery

When all missions in a category are completed in Immersion Mode, a category mastery badge is unlocked on the missions page. This is a visual-only reward displayed on the progression track.

---

## Feature: Mission Settings

A settings area (accessible from the missions page or within a mission) with:

- **Response mode toggle**: Practice Mode (multiple choice) ↔ Immersion Mode (free-type)
- Clear explanation that badges are only earned in Immersion Mode

---

## Feature: Rate Limiting

- Maximum 2 missions per day per user (resets at midnight user's local time, or UTC)
- Counter displayed on the missions page: "1/2 missions remaining today"
- When limit reached, missions are still browsable but the "Start Mission" button is disabled with explanation

---

## AI Integration

### Mission Conversation AI

Each mission requires an AI prompt that:

- Sets the scene and character role
- Defines the 4-5 turn conversation flow with expected topics per turn
- Instructs the AI to respond ONLY in Japanese + romaji (no English, no translations)
- In Practice Mode: generates 3 multiple-choice options per turn (one correct/best, two plausible alternatives) with English meanings
- In Immersion Mode: evaluates the user's free-type response for correctness, naturalness, and comprehension
- Provides per-turn feedback (correct, partially correct, try again)

### Context from Learn Sessions

The AI should receive:

- User's current level and XP
- Recent session summaries (the bridge notes from the summary AI)
- Learning journal excerpt
- This allows the mission AI to calibrate difficulty and vocabulary to what the user has actually studied

### Model

Use the same model as Learn sessions (`gpt-5.2`) for consistency.
Token usage should be tracked in the existing `token_usage` table, following the same pattern as Learn session AI calls.

---

## Database Schema (New Tables)

All tables use Turso SQLite (via @libsql/client). IDs follow the existing `{entity}-{UUID}` convention (e.g., `mission-abc123`, `usermission-abc123`). Boolean values use INTEGER (0/1) per SQLite convention.

### `missions` (static/seed data)

- `id` TEXT PRIMARY KEY
- `title` TEXT
- `category` TEXT (matches TOPIC_CATEGORIES keys)
- `difficulty` TEXT ('easy' | 'medium' | 'hard')
- `sequence` INTEGER (order within category)
- `scenario_prompt` TEXT (AI prompt template)
- `badge_emoji` TEXT
- `badge_name` TEXT
- `badge_statement` TEXT (confidence statement)
- `unlock_sessions_required` INTEGER (Learn sessions needed in category)
- `start_unlocked` INTEGER NOT NULL DEFAULT 0

### `user_missions`

- `id` TEXT PRIMARY KEY
- `user_id` TEXT REFERENCES users(id)
- `mission_id` TEXT REFERENCES missions(id)
- `mode` TEXT ('practice' | 'immersion')
- `status` TEXT ('in_progress' | 'completed')
- `exchanges` INTEGER
- `correct_responses` INTEGER
- `score` REAL
- `xp_earned` INTEGER
- `badge_earned` INTEGER NOT NULL DEFAULT 0
- `conversation_log` TEXT (JSON — full conversation history)
- `completed_at` TIMESTAMP
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### `user_badges`

- `id` TEXT PRIMARY KEY
- `user_id` TEXT REFERENCES users(id)
- `mission_id` TEXT REFERENCES missions(id)
- `badge_emoji` TEXT
- `badge_name` TEXT
- `badge_statement` TEXT
- `earned_at` TIMESTAMP

### `user_mission_limits`

- `user_id` TEXT REFERENCES users(id)
- `date` TEXT (YYYY-MM-DD)
- `missions_used` INTEGER
- PRIMARY KEY (user_id, date)

---

## Route Structure

- `/missions` — Mission catalog page (all categories, progression tracks)
- `/missions/[id]` — Mission chat page (conversation UI)
- `/api/missions` — GET: list missions with user progress and unlock status
- `/api/missions/[id]/start` — POST: start a mission, get first AI turn
- `/api/missions/[id]/respond` — POST: submit user response, get next AI turn + feedback
- `/api/missions/[id]/complete` — POST: finalize mission, calculate XP, award badge

API routes receive `userId` in the request body (matching the existing pattern in session/generate and session/complete). Auth is cookie-based (`site_auth` cookie) but userId is client-provided in API calls.

---

## Dev Override

An environment variable `MISSIONS_UNLOCK_ALL=true` (or a toggle in dev settings) that:

- Makes all missions available regardless of Learn session count
- Removes the daily mission limit
- Useful for testing and debugging

---

## Visual Design Reference

Mockups are available in the brainstorm directory:

- `missions-page-v2.html` — Missions catalog page with category tracks
- `mission-chat-v4.html` — Conversation UI (approved design)
- `mission-chat-v4-modes.html` — Mode comparison and completion screens

All designs use the app's existing warm paper palette (shoji, washi, vermillion, matcha). Gold is reserved exclusively for earned achievement badges.

---

## Out of Scope (MVP)

- Leaderboards or social features
- Mission creation tools
- Voice input for responses
- Missions for categories without defined scenarios (directions, sightseeing, social)
- Difficulty adaptation within a mission (fixed per mission definition)
- Mission-specific items or inventory system

---

END OF SPEC

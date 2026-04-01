# AI Tutor Improvements — Design Spec

## Problem Statement

Three interconnected issues degrade learning quality:

1. **Topic repetition**: Sessions repeat the same topic (e.g., 5-6 hotel sessions) because `inferLessonTopic()` stores exercise type titles ("Translate the phrase") instead of semantic lesson topics ("Hotel check-in"), making topic avoidance ineffective.
2. **Redundant summaries**: Strengths just echo correct answers, weaknesses echo wrong answers (user already saw both during the session). NextSteps suggest external activities ("use flashcards") instead of guiding the app's next session.
3. **Narrow curriculum stages**: Sessions 0-20 are locked to "travel survival only" which is too constraining for variety.

## Approach: Category Rotation + Summary Bridge

### 1. Topic Categories (10 categories)

| #   | Category Key        | Label                   | Example Topics                                   |
| --- | ------------------- | ----------------------- | ------------------------------------------------ |
| 1   | greetings_basics    | Greetings & Basics      | Self-intro, thank you, excuse me, counting       |
| 2   | food_dining         | Food & Dining           | Restaurants, ordering, menu items, dietary needs |
| 3   | transport           | Transport               | Trains, buses, taxis, buying tickets             |
| 4   | shopping            | Shopping                | Convenience stores, souvenirs, prices, sizes     |
| 5   | directions          | Directions & Navigation | Asking the way, landmarks, reading signs         |
| 6   | hotel_accommodation | Hotel & Accommodation   | Check-in/out, room requests, problems            |
| 7   | emergencies_health  | Emergencies & Health    | Pharmacy, doctor, lost items, police             |
| 8   | social_conversation | Social & Conversation   | Small talk, weather, compliments, hobbies        |
| 9   | sightseeing_culture | Sightseeing & Culture   | Temples, museums, etiquette, customs             |
| 10  | bars_nightlife      | Bars & Nightlife        | Izakaya, ordering drinks, karaoke, bar etiquette |

### 2. Rotation Rules

1. **2-3 sessions per category** — builds vocabulary depth before moving on
2. **After 3 sessions in a category, must switch** to a different one
3. **No ping-ponging** — once you leave a category, don't return to it until at least 4 other categories have been visited
4. **Priority weighting for early sessions** — suggest starting with Greetings → Food → Transport → Shopping as a natural flow, but AI adapts based on performance
5. **Replace the rigid session-count curriculum stages** (0-20 travel only, 20-40 daily life, 40+ social/work) with the category rotation system. Difficulty is controlled by the user's level, not by session count.

### 3. Topic Tracking Fix

**Bug**: `inferLessonTopic()` in `src/routes/api/session/complete/+server.ts` extracts the first exercise's title (e.g., "Translate the phrase") instead of the lesson's semantic topic (e.g., "Hotel check-in"). The AI's `lesson.topic` field is never stored.

**Fix**:

- Client (`+page.svelte`) sends `lessonTopic` and `category` from the AI-generated session plan when completing a session (partially done by prior coder agent for lessonTopic)
- `SessionMeta` stores both `category` and `topic`
- `inferLessonTopic()` becomes last-resort fallback only
- Session generation endpoint computes category rotation data from stored `category` fields

**Data stored per session (in SessionMeta)**:

```
category: "bars_nightlife"
topic: "Ordering drinks at an izakaya"
```

**Data passed to session generator AI**:

- Current category streak count (how many consecutive sessions in current category)
- List of recently visited categories with session counts
- Which categories haven't been touched yet
- Last 3-5 sessions' `patterns_weak` and `next_focus` from summaries

### 4. Summary AI Redesign (Bridge Format)

The summary becomes a **handoff note** from one session to the next — concise, pattern-focused, directive.

**New output format**:

```json
{
  "summary": "Brief narrative of the session",
  "patterns_strong": ["Polite request forms", "Basic counters"],
  "patterns_weak": ["Particle usage in location phrases"],
  "next_focus": ["Deepen food vocabulary with complex orders", "Practice te-form conjugation"],
  "levelUpRecommendation": null | { "recommendedLevel": "...", "reason": "..." }
}
```

**Prompt rules (replacing current 13 rules with ~8)**:

1. Only reference exercises that actually appear in results data. Never fabricate.
2. `patterns_strong`: Identify patterns and skills the learner demonstrates consistently — compare with prior sessions from context. Do NOT list individual correct answers.
3. `patterns_weak`: Identify conceptual gaps and confusion patterns — particle mistakes, verb form errors, similar-word confusion. Do NOT list individual wrong answers.
4. `next_focus`: Instructions for what THIS APP's next sessions should cover — specific grammar points, vocabulary areas, or skill progressions. These feed directly back to the session generator AI. Do NOT suggest external activities.
5. All Japanese text must include romaji in parentheses.
6. Keep weaknesses specific to THIS session. Only carry forward a prior weakness if this session shows it's persistent.
7. Evaluate level promotion: recommend only with accuracy >= 80% across recent sessions + clear mastery evidence. If `ready_for_japan`, never recommend promotion.
8. Translation answers conveying the same meaning ARE correct even if phrased differently. Do not penalize natural English.

**Key change**: `strengths` → `patterns_strong`, `weaknesses` → `patterns_weak`, `nextSteps` → `next_focus`. This rename signals the behavioral change to the AI and prevents it from falling back to listing individual answers.

### 5. Session Generator Prompt Changes

**Remove**: Rigid curriculum stages (sessions 0-20, 20-40, 40+)

**Add**: Category rotation context block in the system prompt:

```
TOPIC CATEGORY ROTATION:
Available categories: [list of 10]
Current category streak: "food_dining" × 2 sessions
Recently visited (cannot return yet): ["greetings_basics" (3 sessions ago)]
Never visited: ["bars_nightlife", "emergencies_health"]
Suggested next: Pick from unvisited or sufficiently rotated categories.

PRIOR SESSION NOTES (from summary AI):
- patterns_weak: ["Particle usage in location phrases"]
- next_focus: ["Deepen food vocabulary with complex orders"]
```

**Keep**: Level-based difficulty constraints (LEVEL_RULES), romaji rule, translation variant rules, exercise field requirements

### 6. Journal Impact

No structural changes to the journal mechanism. The journal prompt already receives summary output. With the new concise `patterns_strong`/`patterns_weak`/`next_focus` format, the journal input is tighter and more useful — should reduce journal token usage.

### 7. Backwards Compatibility

- Old sessions without `category` field: treat as `null` category, excluded from rotation calculations
- `inferLessonTopic()` remains as fallback for any session that somehow doesn't send a topic
- Summary parsing: support both old keys (`strengths`, `weaknesses`, `nextSteps`) and new keys (`patterns_strong`, `patterns_weak`, `next_focus`) for backwards compatibility with existing session history

## Files Affected

| File                                         | Changes                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/server/ai.ts`                       | Category list constant, session gen prompt rewrite (rotation context), summary prompt rewrite (bridge format), output parsing for new keys |
| `src/routes/api/session/generate/+server.ts` | Compute category rotation data from session history, pass to AI                                                                            |
| `src/routes/api/session/complete/+server.ts` | Store `category` in SessionMeta, use client-provided topic                                                                                 |
| `src/routes/learn/+page.svelte`              | Send `category` and `lessonTopic` on session completion                                                                                    |
| `src/lib/types.ts`                           | Update SessionMeta type, update SessionSummary type                                                                                        |
| `src/lib/components/SessionSummary.svelte`   | Display new field names (patterns_strong, patterns_weak, next_focus)                                                                       |

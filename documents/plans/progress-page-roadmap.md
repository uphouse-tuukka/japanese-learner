# /progress Page Roadmap (Future Feature)

**Date:** 2026-03-21  
**Status:** Planning only (not in current implementation scope)  
**Purpose:** Define a dedicated `/progress` page that gives users a calm, motivating, and data-rich view of long-term learning progress.

## 1. Product Intent

The current app supports session completion, history, and emerging gamification primitives (XP as **ink strokes / 墨**, streaks, milestones).  
The `/progress` page should become the long-horizon companion view: a place users open to understand trends, celebrate progress, and decide what to focus on next.

### UX principles for this page

- **Zen-styled clarity:** visually calm, low-noise, meaningful hierarchy.
- **Evidence over hype:** progress surfaces should be grounded in real user events.
- **Motivation without pressure:** highlight consistency and momentum, not punishment.
- **Actionable summaries:** each section should suggest what to do next.

---

## 2. Page Information Architecture

Proposed section order (top to bottom):

1. Header summary (current level, total 墨/XP, current streak, next milestone)
2. **XP History**
3. **Level Journey**
4. **Milestone Gallery**
5. **Streak Calendar**
6. **Session History Enhanced**
7. **Skill Breakdown**

Rationale: start with macro trajectory (XP + levels), then achievements/consistency, then detailed performance diagnostics.

---

## 3. Feature Scope by Section

## 3.1 XP History

### What it contains

- Time-series visualization of XP earned with toggles:
  - **Daily** (last 30-90 days)
  - **Weekly** (last 12-26 weeks)
  - **Monthly** (last 12 months)
- Optional overlays:
  - rolling average
  - milestone markers
  - streak breaks

### Why it matters

- Gives users tangible momentum signal.
- Helps users understand consistency vs burst behavior.

### Technical considerations

- Aggregate from immutable XP events (avoid recomputing from mutable session objects only).
- Precompute daily rollups for fast chart rendering.
- Time-zone aware bucket boundaries (user-local date).
- Handle sparse data (show zero-activity periods explicitly).

### UI sketch

```text
+---------------------------------------------------------------+
| XP History                                          [D][W][M] |
|                                                               |
|   墨                                                         * |
| 120 |                                                  *  *   |
|  80 |                                        *   *  *         |
|  40 |                         *   *   *  *                  --- rolling avg
|   0 +---------------------------------------------------------|
|      Mon Tue Wed Thu Fri Sat Sun ...                         |
|  Total this view: 640 墨   Avg/day: 21   Best day: 58         |
+---------------------------------------------------------------+
```

---

## 3.2 Milestone Gallery

### What it contains

- Unified gallery of all milestone definitions:
  - achieved milestones (with achieved date)
  - upcoming milestones (with progress-to-target)
- Group by category:
  - consistency
  - XP/level
  - exercise mastery
  - mission/category completion (future-compatible)

### Why it matters

- Converts abstract progress into concrete achievement moments.
- Keeps near-term goals visible.

### Technical considerations

- Store milestone definitions declaratively (JSON/config + DB unlock events).
- Persist milestone achievement events (timestamp, source trigger).
- Ensure idempotent unlock logic and backfill safety.

### UI sketch

```text
Milestone Gallery

[✓] First Ink       Achieved: 2026-04-03
[✓] 7-Day Flow      Achieved: 2026-04-10
[✓] Level 3 Reached Achieved: 2026-04-18
[ ] 30-Day Flow     Progress: 18 / 30 days
[ ] 10,000 墨        Progress: 7,450 / 10,000
```

---

## 3.3 Streak Calendar

### What it contains

- Contribution-style calendar heatmap of active days.
- Zen visual style (ink intensity for activity depth).
- Monthly navigation + current streak / longest streak summary.

### Why it matters

- Makes consistency visible at a glance.
- Reinforces habit loop without aggressive gamification language.

### Technical considerations

- Daily activity table should include:
  - active flag
  - sessions completed
  - XP earned that day
- Use user-local day boundaries.
- Gracefully handle missed data and partial backfills.

### UI sketch

```text
Streak Calendar (April 2026)

Mon Tue Wed Thu Fri Sat Sun
 .   ░   ▓   ▓   .   █   ░
 ░   ░   .   ▓   ▓   ▓   .
 ...

Current streak: 6 days   Longest streak: 19 days
Legend: . none  ░ light  ▓ medium  █ deep
```

---

## 3.4 Session History Enhanced

### What it contains

An expanded timeline beyond current `/history`:

- XP earned per session
- accuracy per session
- rolling accuracy trend
- session duration + exercise mix
- quick filters (date range, mode, mission/category)

### Why it matters

- Bridges high-level progress and concrete study behavior.
- Enables users to identify “what changed” when performance rises/falls.

### Technical considerations

- Extend session summary model to persist XP and accuracy snapshots at completion.
- Ensure trend lines use consistent denominator logic (avoid skew from tiny sessions).
- Keep pagination/server filtering efficient (cursor + indexed timestamps).

### UI sketch

```text
Session History (Enhanced)

2026-04-20  Learn      +42 墨   Accuracy 84%   18 min   [Grammar, Listening]
2026-04-19  Practice   +25 墨   Accuracy 78%   11 min   [Vocabulary]
2026-04-19  Learn      +38 墨   Accuracy 81%   16 min   [Reading, Ordering]

Accuracy trend (14d): ↗ +6%
```

---

## 3.5 Skill Breakdown

### What it contains

Performance by exercise type (and optionally by topic):

- strengths (high accuracy + stable performance)
- growth areas (low accuracy and/or high error recurrence)
- confidence indicator (sample size aware)

### Why it matters

- Makes practice recommendations evidence-based.
- Prevents users from over-training comfort zones.

### Technical considerations

- Aggregate by exercise type with minimum sample threshold.
- Track both correctness and latency where available.
- Include “insufficient data” state to avoid misleading judgments.

### UI sketch

```text
Skill Breakdown

Listening         88%   Strong
Vocabulary Recall 82%   Strong
Grammar Ordering  71%   Improving
Sentence Build    63%   Focus area

Recommendation: prioritize Sentence Build + Grammar Ordering this week.
```

---

## 3.6 Level Journey

### What it contains

- Visual progression across all **8 user levels**
- Current XP, XP needed for next level, and historical level-up points
- Context on pace (“at current 14-day average, ~X days to next level”)

### Why it matters

- Provides long-term orientation and pacing.
- Connects session effort (short term) to identity/progression (long term).

### Technical considerations

- Keep level thresholds declarative and versioned.
- Persist level-up event history so retrospective timeline is stable.
- If thresholds change later, define migration/display policy clearly.

### UI sketch

```text
Level Journey

L1 ── L2 ── L3 ── L4 ── L5 ── L6 ── L7 ── L8
✓     ✓     ✓    [YOU]  ·     ·     ·     ·

Current: Level 4 (7,450 墨)
Next: Level 5 at 8,200 墨  (750 墨 to go)
Recent pace: ~210 墨/week
```

---

## 4. Data & Backend Readiness Checklist

Before building `/progress`, ensure these foundations are stable:

- event-level XP ledger (`xp_events`)
- daily activity rollups (`user_daily_activity`)
- milestone definitions + unlock events (`milestones`, `user_milestones`)
- session analytics snapshot fields (xp, accuracy, duration, type mix)
- exercise-performance aggregates (by type, date bucket)
- level threshold config + level-up event log

Design preference: deterministic server-side aggregates with lightweight client rendering.

---

## 5. Delivery Strategy (Future)

Recommended phased release for `/progress`:

### Phase A (MVP progress surface)

- Header summary
- XP History (daily + weekly)
- Streak Calendar

### Phase B (Achievement + diagnostics)

- Milestone Gallery
- Session History Enhanced

### Phase C (Coaching depth)

- Skill Breakdown recommendations
- Level Journey pace forecasting

This sequencing provides quick user value while reducing analytics complexity risk.

---

## 6. Risks and Mitigations

- **Risk:** Inconsistent metrics between pages.  
  **Mitigation:** Use shared aggregation utilities and single metric definitions.

- **Risk:** Time-zone boundary bugs in streak/XP charts.  
  **Mitigation:** Centralize local-date derivation and test around day transitions.

- **Risk:** Misleading skill labels due to low sample sizes.  
  **Mitigation:** enforce minimum sample thresholds and show confidence states.

- **Risk:** Visual overload.  
  **Mitigation:** progressive disclosure, collapsible sections, calm defaults.

---

## 7. Non-Goals (for initial `/progress` launch)

- Real-time multiplayer/social leaderboards
- Competitive ranking systems
- Fully custom chart builders
- Advanced predictive modeling beyond simple pace estimates

These can be revisited once core progress reliability and UX clarity are proven.

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

1. Header summary (learning level, total 墨/ink, current streak, next ink milestone)
2. **Ink History**
3. **Learning Level Journey**
4. **Milestone Gallery**
5. **Streak Calendar**
6. **Session History Enhanced**
7. **Skill Breakdown**

Rationale: start with macro trajectory by showing ink momentum and profile learning level separately, then achievements/consistency, then detailed performance diagnostics.

---

## 3. Feature Scope by Section

## 3.1 Ink History

### What it contains

- Time-series visualization of ink earned with toggles:
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

- Aggregate from immutable ink/XP events (avoid recomputing from mutable session objects only).
- Precompute daily rollups for fast chart rendering.
- Time-zone aware bucket boundaries (user-local date).
- Handle sparse data (show zero-activity periods explicitly).

### UI sketch

```text
+---------------------------------------------------------------+
| Ink History                                         [D][W][M] |
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
  - ink/XP milestones
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
[✓] Listening Focus Achieved: 2026-04-18
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
  - ink earned that day
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

- ink earned per session
- accuracy per session
- rolling accuracy trend
- session duration + exercise mix
- quick filters (date range, mode, mission/category)

### Why it matters

- Bridges high-level progress and concrete study behavior.
- Enables users to identify “what changed” when performance rises/falls.

### Technical considerations

- Extend session summary model to persist ink/XP and accuracy snapshots at completion.
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

## 3.6 Learning Level Journey

### What it contains

- Visual progression across all **8 user learning levels**
- Current profile/tutor level from `users.level`
- Next learning level label, without ink/XP requirements
- Clear copy that learning level changes through tutor recommendations/profile updates, not ink totals

### Why it matters

- Provides long-term orientation for the learner's current tutor/profile level.
- Keeps learning level separate from short-term activity rewards.

### Technical considerations

- Treat `users.level` and ink/XP totals as separate systems.
- Do not derive learning level from `user_xp` totals.
- If persisted level-up event history is added later, model it as tutor/profile level history, not XP threshold history.

### UI sketch

```text
Learning Level Journey

L1 ── L2 ── L3 ── L4 ── L5 ── L6 ── L7 ── L8
✓     ✓     ✓    [YOU]  ·     ·     ·     ·

Current: Pre-Intermediate
Next learning level: Intermediate
Level changes through tutor recommendations, not ink totals.
```

---

## 4. Data & Backend Readiness Checklist

Before building `/progress`, ensure these foundations are stable:

- event-level ink/XP ledger (`xp_events`)
- daily activity rollups (`user_daily_activity`)
- milestone definitions + unlock events (`milestones`, `user_milestones`)
- session analytics snapshot fields (xp, accuracy, duration, type mix)
- exercise-performance aggregates (by type, date bucket)
- profile/tutor learning level history, if future level-change history is needed

Design preference: deterministic server-side aggregates with lightweight client rendering.

---

## 5. Delivery Strategy (Future)

Recommended phased release for `/progress`:

### Phase A (MVP progress surface)

- Header summary
- Ink History (daily + weekly)
- Streak Calendar

### Phase B (Achievement + diagnostics)

- Milestone Gallery
- Session History Enhanced

### Phase C (Coaching depth)

- Skill Breakdown recommendations
- Learning Level Journey profile/tutor level context

This sequencing provides quick user value while reducing analytics complexity risk.

---

## 6. Risks and Mitigations

- **Risk:** Inconsistent metrics between pages.  
  **Mitigation:** Use shared aggregation utilities and single metric definitions.

- **Risk:** Time-zone boundary bugs in streak/ink charts.
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

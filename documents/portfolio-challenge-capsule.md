# Portfolio Challenge Capsule Plan

Generated from `/office-hours` and `/plan-eng-review` on 2026-04-04  
Branch: `master`  
Repo: `uphouse-tuukka/japanese-learner`  
Status: **APPROVED PLAN**

This document is the single source of truth for the portfolio capsule going forward.
It supersedes the temporary session-state implementation plan and the earlier design-only draft.

## Problem

`japanese-learner` started as a private hobby app for the user and their friends.
It is now strong enough to link from a portfolio, but the app should remain friend-only.

The job is to add one public path that proves the product is real, polished, and technically serious, without accidentally creating a free public AI product.

## Product thesis

The right cut is not a guest account and not a fake walkthrough.
It is one real, tightly-scoped interactive moment.

A visitor should:

1. understand the idea in a few seconds
2. do one real Japanese challenge
3. get one honest result
4. see a tiny builder-facing explanation of how the system worked

That is enough.

## Constraints

- the main app stays primarily for the user and their friends
- the portfolio route must be public and shareable
- the public path must not become a repeatable free AI loop
- the experience should feel crafted, not like a generic AI demo
- the route should prove product taste, not just model integration
- abuse prevention matters more than session length

## Final V1 decisions

### Core cut

- **Public route:** `/portfolio/challenge`
- **Challenge format:** one travel-themed AI-generated multiple-choice challenge
- **Interaction shape:** one prompt, one submission, one result state, then stop
- **Persistence:** no learner profile and no normal progress writes
- **Builder reveal depth:** small, human-readable, not raw logs
- **Adaptation claim:** V1 proves real generation and real evaluation, not live in-session branching

### Engineering cut

- no DB-backed showcase session record
- one signed challenge token
- one DB-backed attempts table for quota enforcement
- one dedicated public route and two dedicated public API endpoints
- one small portfolio-only signed-token helper
- one dedicated `portfolio-challenge.ts` server module

### Security and cheating posture

The challenge token is used for **integrity and expiry**, not secrecy.
If a determined visitor inspects the payload and discovers the correct answer, that is acceptable for this portfolio demo.

This route should still protect:

- auth boundaries
- API boundaries
- token spend
- accidental repeat use

It does **not** need competitive anti-cheating hardening.

## User experience

### Visitor flow

1. Visitor lands on `/portfolio/challenge`
2. Page explains the concept in one short framing block
3. Visitor starts one live challenge
4. `/api/portfolio/challenge/start` returns one AI-generated multiple-choice exercise plus a signed challenge token
5. Visitor submits one answer
6. `/api/portfolio/challenge/submit` grades the result deterministically
7. Page flips to a result view with a small builder-facing explanation
8. Flow ends

### First-screen information hierarchy

The first viewport should read in this order:

1. **Product promise:** this is a real Japanese learning product, not a toy demo
2. **Immediate action:** one live challenge can be started now
3. **Trust frame:** this is a one-shot public capsule, not the full private app

If any other element competes with those three jobs, cut it.

### First viewport composition

The page should open as a split composition, not a centered marketing hero and not a dashboard.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ portfolio challenge viewport                                        │
├───────────────────────────────┬──────────────────────────────────────┤
│ left: framing column          │ right: live capsule                 │
│                               │                                      │
│ eyebrow / product label       │ challenge card shell                │
│ one strong headline           │ short start-state instruction       │
│ one supporting sentence       │ one primary CTA                     │
│ one trust note                │ answer area / result area           │
│                               │                                      │
│ optional tiny case-study link │ small status / cap note             │
└───────────────────────────────┴──────────────────────────────────────┘
```

Rules:

- left column sells the product idea
- right column proves it with a real interaction
- keep both columns visible on desktop without scrolling
- the right column should feel slightly more visually dense, because it is the proof
- the left column should stay quieter and more typographic

### Approved v1 mockup direction

The approved first-version mockup direction is the **proof-first split**.

What that means:

- keep the split layout from the stronger right-hand challenge composition
- keep the headline as **one uninterrupted text block**, not two split rows
- let the challenge card carry slightly more visual weight than the framing copy
- keep the framing column calmer and more editorial

The copy tone should stay personal and low-hype.

Use language closer to:

- “Feel free to try a short challenge from my Japanese learning app.”
- “After you answer, I’ll share a little about how it works.”

Avoid language that sounds like marketing copy, such as:

- “one live experience”
- “one live challenge” as the main pitch
- “launch page” style urgency or productized hype

The goal is to sound like a builder inviting someone to try a real piece of the app, not a product page trying to convert them.

### Above-the-fold content budget

Above the fold should contain only:

- one eyebrow or product label
- one headline
- one supporting sentence
- one trust note about the one-shot public capsule
- the live challenge card in start state
- one small cap or availability note

Do not add feature grids, testimonial blocks, extra product sections, or repeated explanatory copy above the fold.

### Page structure below the fold

The page should keep a single downward rhythm after the split viewport:

```text
1. split first viewport
2. three-step "how it works" strip
3. result/fallback follow-up area
4. one quiet link to deeper case-study material
```

Every section gets one job only.

### Result view contents

After completion, the visitor sees:

1. **Verdict chip:** `Correct` or `Not yet`
2. **Short explanation:** one or two sentences about why the answer was right or wrong
3. **Full-product next step:** one sentence explaining what the real product would reinforce next
4. **Builder view card:** three tiny facts only
   - live AI-generated challenge under hard cap
   - deterministic grading for reliability
   - this route stores no permanent learner profile

The builder note appears **only after submit** as part of the result state.
It should never compete with the challenge before the user has experienced the core interaction.

### Builder-view payload definition

V1 builder view stays intentionally small.
It should show:

- the generated prompt
- the answer choices
- the correct answer
- the explanation returned by generation
- one short note that this was a public one-shot challenge, not a real saved learner session

### Fallback mode

When live mode is unavailable, the same page should show:

1. one polished screenshot of the real product
2. three bullets explaining what the full system does
3. one short architecture note
4. one link to a deeper case-study page

Do not fake a live result.

The fallback should appear **in place** inside the right-side live capsule area.
Do not break the page into a different layout, and do not visually promote the fallback above the original product promise.

### Interaction state coverage

| Feature                   | Loading                                                                     | Empty          | Error                                                                                | Success                                                              | Partial                                                                                           |
| ------------------------- | --------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| first page load           | quiet skeleton blocks inside the split layout, headline visible immediately | not applicable | calm inline apology if page data fails, keep page chrome intact                      | promise + start-ready capsule visible                                | not applicable                                                                                    |
| start challenge           | CTA shows pending state, challenge card preserves its dimensions            | not applicable | capsule switches to a “live capsule is resting” state with fallback content          | challenge question replaces start state without layout jump          | if retry is in progress, keep the same card and show a short status note                          |
| submit answer             | submit button shows pending state, answer area stays visible                | not applicable | inline submit failure message inside result area, answer selection preserved if safe | result state replaces question state in the same card                | if result payload is incomplete, show verdict plus short explanation and suppress builder details |
| quota exhausted           | not applicable                                                              | not applicable | not treated as a red error state                                                     | calm “resting” state with screenshot + explanation + case-study link | not applicable                                                                                    |
| live unavailable fallback | small loading shimmer while fallback content swaps in                       | not applicable | clear apology copy, no dead-end screen                                               | polished static fallback module in the existing capsule frame        | not applicable                                                                                    |

### State design rules

- never blank the whole page during loading
- preserve the card height between start, question, result, and resting states as much as possible
- error copy should sound calm and confident, not technical
- the fallback state should feel like a curated exhibit panel, not a broken replacement
- result and fallback should both live inside the same right-column frame so the page keeps its composure

### User journey storyboard

| Step | User does                       | User feels               | Plan response                                                                                  |
| ---- | ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| 1    | lands on the page               | curious but skeptical    | first viewport explains the product promise immediately and shows a real interaction beside it |
| 2    | scans the framing copy          | oriented                 | one headline, one supporting sentence, one trust note, no extra noise                          |
| 3    | notices the challenge capsule   | intrigued                | the right column looks live, finite, and specific                                              |
| 4    | starts the challenge            | committed                | the card responds in place, without a layout jump                                              |
| 5    | reads and answers               | focused                  | the interface gets quieter and keeps attention on the question                                 |
| 6    | submits                         | slightly tense           | button and card acknowledge progress without drama                                             |
| 7    | sees the result                 | respected and informed   | calm verdict, short explanation, understated builder note                                      |
| 8    | sees fallback or next-step link | still trusts the product | no dead end, only a quieter continuation into deeper material                                  |

### Emotional arc rules

- first 5 seconds: curiosity and trust
- challenge moment: focus, not hype
- result moment: quiet confidence, not gamified celebration
- builder reveal: informative, but always secondary to the learner-facing result
- fallback mode: graceful and composed, never apologetic to the point of sounding broken

## AI slop guardrails

The page is a **hybrid** surface: portfolio-facing first impression, app-like interaction second.

### Visual anchor rule

The live challenge capsule is the primary visual anchor.
Typography, spacing, and proportion should do most of the aesthetic work around it.
Do not invent a separate decorative hero object that competes with the challenge.

### Hard rejection patterns

Do not ship the portfolio path with any of these:

1. centered-everything hero composition
2. generic three-column feature grid
3. decorative icon circles
4. purple, violet, or blue-to-purple gradient styling
5. stock “AI product” illustration or abstract blob filler
6. emoji as design elements
7. dashboard-card mosaic layout
8. repeated sections saying the same thing in slightly different words

### Composition rules

- first viewport should read as one composition, not stacked marketing blocks
- cards should appear only where the card **is** the interaction
- the left column is typographic and quiet
- the right column is the proof surface and earns slightly more visual weight
- remove any element that does not help the visitor understand, act, or trust

## Responsive and accessibility rules

### Responsive behavior

**Desktop**

- use the split composition
- keep promise and live capsule visible together above the fold

**Tablet**

- preserve two-column intent if space allows
- if columns tighten too much, reduce copy before collapsing layout

**Mobile**

- stack promise first, challenge second
- keep both inside the first scroll span
- the primary CTA should appear quickly without a long text preamble
- the challenge card should remain visually dominant after the promise block
- do not hide the trust note behind accordions or extra taps
- keep the same softer personal tone as desktop, not shorter marketing copy

### Accessibility rules

- use clear page landmarks: header, main, and region labels where helpful
- keep all interactive targets at least 44px tall
- preserve full keyboard access for start, answer selection, submit, and case-study link
- ensure visible focus states that fit the existing token system
- maintain readable contrast for all text and state indicators
- do not rely on color alone for correct, incorrect, resting, or unavailable states
- keep loading and fallback copy screen-reader readable
- result and error state changes should be announced clearly

## Hard caps for V1

- **Max live completions per browser session:** 1 per 24 hours
- **Max challenge starts per IP:** 3 per 24 hours
- **Max model calls per challenge:** 3
- **Max token budget per challenge:** 5,000 total tokens
- **End-to-end timeout:** 45 seconds
- **Retry policy:** one automatic retry on transient AI failure, no user-triggered retries after a successful completion

## Architecture

### Public surfaces

- page: `/portfolio/challenge`
- start endpoint: `/api/portfolio/challenge/start`
- submit endpoint: `/api/portfolio/challenge/submit`

Only those three paths bypass the normal friend-only auth gate.
Everything else stays private.

### Request flow

```text
anonymous visitor
    |
    v
/portfolio/challenge  ----------------------------+
    |                                             |
    | root layout sees /portfolio/*               |
    | and renders public shell                    |
    v                                             |
Start challenge button                            |
    |                                             |
    v                                             |
POST /api/portfolio/challenge/start               |
    |                                             |
    +--> hooks whitelist allows endpoint          |
    +--> quota check via attempts table           |
    +--> visitor cookie created or reused         |
    +--> AI generator builds one MC challenge     |
    +--> signed challenge token minted            |
    v                                             |
challenge payload returned <----------------------+
    |
    v
Submit answer
    |
    v
POST /api/portfolio/challenge/submit
    |
    +--> verify signed challenge token
    +--> enforce expiry/tamper/duplicate rules
    +--> deterministic grading
    +--> return result + builder-view payload
    v
result state or fallback state
```

### Auth and shell boundary

- `src/hooks.server.ts` must explicitly whitelist the portfolio page and the two portfolio APIs
- `src/routes/+layout.svelte` must special-case `/portfolio/*` and render a small public shell
- the portfolio flow must never depend on `selected_user`
- the portfolio path must not expose other `/api/*` routes

### Signed token

Use a small signed-token helper dedicated to the portfolio flow.

The token should carry only what submit needs:

- challenge id
- expiry timestamp
- correct answer
- explanation and small builder-view metadata needed after grading

This avoids a DB-backed challenge record just to grade one answer.

### Visitor cookie

Use one anonymous cookie for quota bucketing:

- name: `portfolio_visitor`
- value: random UUID
- creation: first successful start response
- max age: 24 hours
- flags: `httpOnly`, `sameSite=lax`, `secure` in production
- first request behavior: if cookie is absent, check IP quota only, then set cookie in the response

### Data model

Only one public quota table is needed:

```text
portfolio_challenge_attempts
    |
    +-- id
    +-- cookie_id
    +-- ip_hash
    +-- status      (started | completed | blocked | expired)
    +-- started_at
    +-- completed_at
    +-- expires_at

Indexes
    +-- (cookie_id, started_at)
    +-- (ip_hash, started_at)
    +-- (expires_at)
```

Rules:

- store IP as an HMAC hash with a server secret, never raw IP text
- use append-only attempt rows plus indexed count queries over the last 24 hours
- run lazy cleanup on access
- use the cookie as the primary per-visitor limiter and IP hash as coarse backup

## What already exists

These parts already solve part of the problem and should be reused:

- `src/hooks.server.ts` for site-wide auth gating
- `src/routes/+layout.svelte` for top-level shell decisions
- `src/lib/server/auth.ts` for the existing HMAC and timing-safe comparison pattern
- `src/lib/server/ai.ts` for exercise normalization and multiple-choice validation
- `src/lib/components/exercises/MultipleChoiceExercise.svelte` for the interaction shape
- `src/lib/server/token-limiter.ts` for budget and counting concepts
- `src/lib/server/db.ts` for schema initialization and DB setup
- existing `vitest` setup for server-side tests

### Design system alignment

There is no dedicated `DESIGN.md`, so the portfolio path should align to the live token system in `src/app.css`.

Reuse these existing decisions:

- warm paper background tokens: `--bg-shoji`, `--bg-washi`, `--bg-kinu`
- sumi text hierarchy: `--text-sumi`, `--text-bokashi`, `--text-usuzumi`
- vermillion accent system: `--accent-shu`, `--accent-shu-soft`, `--accent-shu-deep`
- restrained radii: `--radius-sm`, `--radius-md`, `--radius-lg`
- calm spacing scale built on `--space-*`
- existing button vocabulary and interaction pacing

Rules:

- do not introduce a separate portfolio-only color palette
- do not introduce a new font stack
- do not increase radius, shadow, or motion intensity beyond the rest of the app
- the portfolio route may feel more editorial than the authenticated app, but it must still read as the same product family

## What is new

- a public route shell for `/portfolio/*`
- auth whitelist exceptions for exactly three portfolio paths
- a small portfolio-only signed-token helper
- a `portfolio_challenge_attempts` table with indexes
- a `src/lib/server/portfolio-challenge.ts` orchestration module
- a dedicated AI helper for one portfolio multiple-choice challenge
- a small Playwright suite for the capsule

## Implementation plan

### Step 1: add portfolio signed-token helper

**Modules**

- new `src/lib/server/signed-token.ts`

**Work**

- add a small HMAC signer/verifier for portfolio challenge payloads
- support generic payload signing with expiry

**Why**

- keeps the portfolio flow boring and testable
- avoids refactoring already-working auth code for no user benefit

### Step 2: add public shell exception

**Modules**

- `src/hooks.server.ts`
- `src/routes/+layout.svelte`
- `src/routes/+layout.server.ts` if route flags are needed

**Work**

- whitelist `/portfolio/challenge`
- whitelist `/api/portfolio/challenge/start`
- whitelist `/api/portfolio/challenge/submit`
- render a public shell for `/portfolio/*` instead of the invite-only login gate

**Why**

- prevents the portfolio link from dumping visitors into a password wall
- keeps the diff small and avoids a bigger route-group refactor

### Step 3: add quota persistence

**Modules**

- `src/lib/server/db.ts`
- `src/lib/server/portfolio-challenge.ts`

**Work**

- add `portfolio_challenge_attempts` schema
- add indexed query helpers:
  - record attempt start
  - mark attempt completed / blocked / expired
  - count recent starts by cookie id
  - count recent starts by IP hash
  - lazy-delete expired rows
- hash IPs before persistence

**Why**

- durable public-route throttling
- no extra infrastructure

### Step 4: add portfolio challenge orchestration

**Modules**

- new `src/lib/server/portfolio-challenge.ts`
- `src/lib/server/ai.ts`

**Work**

- add `generatePortfolioChallenge()` that returns one validated multiple-choice exercise
- add start orchestration:
  - lazy cleanup
  - quota checks
  - visitor cookie creation or verification
  - AI generation
  - signed token minting
  - fallback response shaping
- add submit orchestration:
  - signed token verification
  - expiry and tamper checks
  - deterministic grading
  - duplicate submit handling
  - builder-view payload shaping

**Why**

- keeps route handlers thin
- centralizes the public capsule logic in one testable module

### Step 5: add public route and endpoints

**Modules**

- new `src/routes/portfolio/challenge/+page.svelte`
- new `src/routes/portfolio/challenge/+page.server.ts` if server-loaded fallback data is needed
- new `src/routes/api/portfolio/challenge/start/+server.ts`
- new `src/routes/api/portfolio/challenge/submit/+server.ts`
- small portfolio-specific challenge presenter component if the page benefits from extracting it

**Work**

- build the start state
- build the active challenge state
- build the result state
- build the unavailable or fallback state
- keep portfolio-specific DTOs local to this feature
- reuse the existing multiple-choice interaction patterns and tokens, but do not force the private app's full `MultipleChoiceExercise.svelte` contract onto the portfolio route

**Why**

- small public artifact
- no leakage into the normal learner flow

### Portfolio page state model

The portfolio page should use one explicit local view-state model instead of a pile of booleans.

Suggested state family:

- `intro`
- `starting`
- `active`
- `submitting`
- `result`
- `resting`
- `error`

Rules:

- states should be mutually exclusive
- result and resting should carry their own render payloads
- route-local types are preferred over widening `src/lib/types.ts`
- the page component should render by state first, not by scattered boolean checks

### Step 6: tests

**Modules**

- new `src/lib/server/signed-token.test.ts`
- new `src/lib/server/portfolio-challenge.test.ts`
- route or hook tests near touched modules
- new Playwright suite
- manual eval checklist artifact

**Work**

- add mandatory regression tests for auth-gate behavior
- add unit tests for signer, quota counting, token tamper or expiry, duplicate submit, and fallback shaping
- add route tests for start and submit handlers
- add browser E2E:
  - public shell renders
  - start -> answer -> result
  - quota fallback remains usable
- add a manual eval checklist for 5 to 10 generated challenges

**Why**

- this feature fails at the integration seam, not just inside helpers

## Test coverage plan

```text
CODE PATH COVERAGE PLAN
===========================
[+] hooks.server.ts
    ├── public portfolio page bypass            [unit/integration regression]
    ├── public portfolio APIs bypass            [unit/integration regression]
    └── all other APIs remain locked            [unit/integration regression]

[+] root +layout.svelte
    ├── /portfolio/* renders public shell       [component/integration regression]
    └── normal unauthenticated routes login     [component/integration regression]

[+] portfolio page state model
    ├── intro                                   [component/unit]
    ├── starting                                [component/unit]
    ├── active                                  [component/unit]
    ├── submitting                              [component/unit]
    ├── result                                  [component/unit]
    ├── resting                                 [component/unit]
    └── error                                   [component/unit]

[+] signed-token helper
    ├── valid token                             [unit]
    ├── expired token                           [unit]
    ├── tampered signature                      [unit]
    └── wrong payload shape                     [unit]

[+] portfolio start flow
    ├── quota allowed                           [unit/integration]
    ├── cookie created                          [unit/integration]
    ├── AI output valid                         [unit/integration]
    ├── AI output malformed -> fallback         [unit/integration]
    └── quota blocked -> fallback               [unit/integration]

[+] portfolio submit flow
    ├── correct answer                          [unit/integration]
    ├── wrong answer                            [unit/integration]
    ├── expired token                           [unit/integration]
    ├── tampered token                          [unit/integration]
    └── duplicate submit                        [unit/integration]

USER FLOW COVERAGE PLAN
===========================
[+] anonymous visitor
    ├── open portfolio link                     [Playwright E2E]
    ├── start one challenge                     [Playwright E2E]
    ├── submit answer, see result               [Playwright E2E]
    └── blocked quota, still see fallback       [Playwright E2E]

[+] portfolio UX guarantees
    ├── builder note hidden until submit        [Playwright E2E]
    ├── mobile order: promise then challenge    [Playwright E2E]
    ├── loading state keeps page framed         [component/integration]
    └── error state preserves trust             [component/integration]

[+] AI quality
    └── 5-10 generated challenges reviewed      [manual eval checklist]
```

## Failure modes

| Codepath           | Realistic production failure                                 | Test planned | Error handling planned | User-visible outcome                         |
| ------------------ | ------------------------------------------------------------ | -----------: | ---------------------: | -------------------------------------------- |
| public page access | whitelist missing, page shows login gate                     |          yes |                    yes | clear wrong-shell regression caught pre-ship |
| start endpoint     | quota query scans too much or expired rows pile up           |          yes |                    yes | graceful fallback, not dead page             |
| start endpoint     | AI output malformed                                          |          yes |                    yes | fallback content shown                       |
| submit endpoint    | token tampered or expired                                    |          yes |                    yes | clear error or fallback, not silent failure  |
| submit endpoint    | duplicate submit inflates usage or changes result            |          yes |                    yes | blocked with deterministic response          |
| public shell       | unauthenticated normal app route accidentally becomes public |          yes |                    yes | regression test catches it                   |

No planned codepath should ship with no test, no error handling, and a silent failure.

## NOT in scope

- full guest account flow, because that turns the capsule into a second product
- public progress tracking or persistent learner state, because the capsule is one-shot only
- adaptive second turn in-session, because V1 proves generation and evaluation, not full live adaptation
- external rate-limit infrastructure, because one libSQL table is enough here
- deep builder observability UI, because the builder view should stay tiny and tasteful
- V2 case-study depth, because the live capsule is the shipping priority
- anti-cheating secrecy for client-visible answer data, because this is a portfolio demo, not a security-sensitive competition flow

## Success criteria

- a portfolio visitor understands the concept in under 10 seconds
- a visitor can complete one real challenge and understand the result in under 3 minutes
- the route proves vision, design quality, product quality, and technical credibility
- the public path does not create normal users, permanent learner state, or a repeatable free AI loop
- token exposure stays bounded and predictable
- the experience feels premium and intentional, not hacked-on

## Distribution plan

This is not a new product.
It is a public route inside the existing web app.

- **Distribution channel:** a portfolio link to `/portfolio/challenge`
- **Deployment:** existing site deployment ships it
- **CI/CD:** existing app deploy flow covers it, no separate artifact pipeline needed
- **Portfolio integration:** add a case-study entry that links directly to the challenge capsule and a deeper write-up

## Worktree parallelization strategy

| Step                     | Modules touched                                      | Depends on                                        |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------------- |
| signer helper            | `src/lib/server/`                                    | —                                                 |
| public shell + whitelist | `src/routes/`, `src/hooks.server.ts`                 | —                                                 |
| quota persistence        | `src/lib/server/`                                    | —                                                 |
| portfolio orchestration  | `src/lib/server/`                                    | signer helper, quota persistence                  |
| portfolio page + APIs    | `src/routes/portfolio/`, `src/routes/api/portfolio/` | public shell + whitelist, portfolio orchestration |
| tests                    | `src/lib/server/`, `src/routes/`, `tests/e2e/`       | all prior steps                                   |

### Parallel lanes

- **Lane A:** signer helper -> portfolio orchestration
- **Lane B:** public shell + whitelist
- **Lane C:** quota persistence
- **Lane D:** portfolio page + APIs
- **Lane E:** tests

### Execution order

Launch **Lane B** and **Lane C** in parallel.  
Merge them.  
Run **Lane A**.  
Then run **Lane D**.  
Then run **Lane E**.

### Conflict flags

- Lanes A and C both touch `src/lib/server/`, so do not run them in parallel
- Lane D depends on both route-shell and orchestration work, so do not start it early

## Initial implementation checklist

1. Add a portfolio-only signed-token helper.
2. Add portfolio whitelist logic in `hooks.server.ts` and the public-shell exception in `src/routes/+layout.svelte`.
3. Add `portfolio_challenge_attempts` schema, indexes, and DB helpers.
4. Implement `src/lib/server/portfolio-challenge.ts` and the dedicated AI generator.
5. Build `/portfolio/challenge` plus start and submit endpoints and fallback states.
6. Add Vitest, Playwright, and manual eval coverage for the capsule.

## GSTACK review report

| Review        | Trigger               | Why                             | Runs | Status | Findings                         |
| ------------- | --------------------- | ------------------------------- | ---- | ------ | -------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —      | —                                |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —      | —                                |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 3    | CLEAR  | 6 issues, 0 critical gaps        |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 1    | CLEAR  | score: 7/10 -> 9/10, 6 decisions |

**UNRESOLVED:** 0

**VERDICT:** ENG + DESIGN CLEARED, ready to implement.

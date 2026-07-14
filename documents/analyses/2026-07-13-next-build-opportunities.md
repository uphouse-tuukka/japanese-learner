# Next Build Opportunities

**Date:** 2026-07-13

**Mode:** Evidence-backed opportunity scouting

## Executive recommendation

Build a single **Spoken Can-do Loop** around one existing Travel Mission.
The first slice should ask the learner to complete a short real-world task by voice, turn the observed misses into fresh transfer practice, and then offer a later retry of the same communicative goal with different wording.
Start with **Order at a Restaurant** because the mission, speaking capture, transcription, semantic grading, session coverage, and review-candidate foundations already exist.

Do not begin with a broad realtime voice-call system or another progress dashboard.
The first product question is whether a learner becomes more capable at a concrete travel task, not whether the app can sustain an open-ended conversation or draw more charts.

## Decision context

Japanese Learner is a personal travel-readiness tutor for the owner and a few friends, not a scalable SaaS product.
The current codebase already contains Learning Sessions, weighted Practice, ten Travel Missions, a speaking exercise with microphone capture and server-side transcription, Coverage Evidence, Review Candidates, a Learning Journal, XP and streaks, and a detailed progress page.
Travel Missions and speaking are currently separate product surfaces.
Practice currently selects and reuses exercises from completed sessions, while Coverage Evidence independently derives phrase and Lesson Topic Review Candidates.
The checkout has no local environment file or accessible learner-usage telemetry, so this analysis is based on source behavior, documented product intent, learning research, and current competitor capabilities rather than observed retention or completion data.

The current working branch backs open PR #4, a low-risk session-resume fix.
New feature work should start from the updated default branch after that PR lands.

## Evaluation method

Options were ranked by travel-outcome impact, strength of evidence, fit with the existing architecture and domain model, and learning leverage.
Development cost was not used as a primary ranking criterion.
Small validations are proposed to expose product and learning risk before broad implementation.

## Ranked opportunities

### 1. Spoken Can-do Loop

- **Idea:** Add a three-turn voice checkpoint to one Travel Mission, score whether the learner accomplished the communicative task, generate fresh practice from the misses, and offer a delayed retry with a varied version of the scenario.
- **Why now:** The app already owns both halves of the experience, but the mission evaluator accepts text while the speaking checker is confined to individual exercises.
- **Evidence:** `missions-ai.ts` already evaluates contextual appropriateness and natural phrasing, `speaking-checker.ts` already transcribes browser audio and grades communicative intent, and the Japan Foundation frames proficiency around tasks a learner can accomplish in Japanese rather than vocabulary or grammar counts.
- **Fit:** This directly serves the product mission of practical Japan travel readiness and creates a coherent use for the existing mission, speaking, review, and progress foundations.
- **Risk:** Automatic speech recognition can confuse accent or microphone failure with language failure, and a three-turn script can still feel rehearsed if the retry does not vary the prompts.
- **First validation:** Prototype only `mission-order-restaurant` with push-to-talk responses, one clarification or repair turn, no pronunciation score, and a task-completion result that is kept separate from XP.
- **Next skill:** `$prototype`, followed by `$grill-with-docs` if the interaction and evidence model feel promising.

### 2. Adaptive Transfer Practice

- **Idea:** Replace some exact exercise replay with new exercises that test the same Review Candidate in a different sentence or travel situation.
- **Why now:** Coverage Evidence now derives structured phrase and Lesson Topic Review Candidates, but Practice still draws stored exercises from `user_exercise_results` and reuses the original items.
- **Evidence:** Controlled retrieval-practice experiments found better transfer when learners retrieved and applied a concept through different examples than when they repeated the same example.
- **Fit:** It deepens the existing learning loop without requiring a new top-level product surface and can feed both ordinary Practice and the proposed mission retry.
- **Risk:** AI-generated variants can drift from the target concept, introduce language above the learner's level, or accidentally make the answer obvious.
- **First validation:** Generate a four-item practice set from one high-strength Review Candidate, retain the source identity in metadata, and manually review ten generated sets for semantic fidelity before exposing scoring.
- **Next skill:** `$prototype`, then `$to-prd` once the variation and validation contract is stable.

### 3. Scenario Readiness Map

- **Idea:** Reframe progress around authored travel Can-dos such as ordering a meal, buying a ticket, and recovering from a misunderstanding, with evidence states such as untried, supported, independent, and needs review.
- **Why now:** The progress page is already rich in XP, streak, history, and exercise-type accuracy, but none of those measures answers the owner's core question: what can I now handle in Japan?
- **Evidence:** The Japan Foundation and ACTFL both define proficiency through communicative tasks performed in real-world, often spontaneous contexts.
- **Fit:** Existing mission categories, completion records, speaking results, Coverage Evidence, and progress view models can provide inputs after the evidence semantics are defined.
- **Risk:** A readiness label can create false confidence if it is inferred from XP or a single guided success.
- **First validation:** Author five project-specific Can-dos and display evidence for only the restaurant checkpoint, with no overall percentage and a clear distinction between supported and independent performance.
- **Next skill:** `$grill-with-docs` to define evidence semantics before UI work.

### 4. Conversation Repair Lab

- **Idea:** Teach and test recovery moves such as asking someone to repeat, slow down, confirm a price, or rephrase a question.
- **Why now:** Real travel interactions fail in the unpredictable middle, while current missions mostly reward selecting or composing a direct answer to the expected turn.
- **Evidence:** The Japan Foundation's Can-do model explicitly treats communication strategies as part of effective language use, and task-based guidelines emphasize accomplishing the goal rather than displaying isolated grammar knowledge.
- **Fit:** Repair turns can become reusable mission events across restaurant, transport, hotel, and emergency scenarios.
- **Risk:** If every mission injects an artificial misunderstanding, the mechanic will become predictable and gameable.
- **First validation:** Add one optional repair branch to the restaurant voice checkpoint and test whether a learner can recover without an English hint.
- **Next skill:** `$prototype`.

### 5. Personal Itinerary Rehearsals

- **Idea:** Let the owner enter a few real trip facts such as station pairs, hotel name, dietary constraints, and planned activities, then generate private mission variants around those facts.
- **Why now:** Generic AI conversation is now common in language products, while this app's personal scope makes deep itinerary specificity both practical and defensible.
- **Evidence:** Busuu and Duolingo already offer level-aware AI conversations or video calls, so generic roleplay is parity rather than a distinctive destination.
- **Fit:** The app is intentionally personal, already generates mission turns, and does not need a general-purpose content-authoring system.
- **Risk:** The feature can become trip-planning software, store unnecessarily sensitive details, or overfit the learner to a script that will not occur.
- **First validation:** Hard-code one upcoming route or restaurant constraint into a local mission variant and compare usefulness against the generic mission without persisting itinerary data.
- **Next skill:** `$prototype`.

### 6. Next Best Action Router

- **Idea:** Replace the home page's fixed Learn and Practice choice with one recommended next action based on category rotation, high-strength Review Candidates, stale mission evidence, and recent failures.
- **Why now:** The app has accumulated several strong modes, but the learner must decide which loop to enter and the system's rich evidence is mostly hidden from that decision.
- **Evidence:** Coverage Evidence already selects category rails and Review Candidates, while the current home page always promotes a new Learning Session and offers Practice as a secondary link.
- **Fit:** This is an AI-native orchestration use of data the app already computes and can keep the existing routes intact.
- **Risk:** A recommendation can feel arbitrary or remove learner agency if it does not explain the evidence or allow an easy override.
- **First validation:** Compute a deterministic recommendation for three fixture histories and show it as a removable home-page card with a one-sentence reason.
- **Next skill:** `$prototype`.

### 7. Offline Trip Companion

- **Idea:** Add an installable, offline-capable view containing only phrases and audio the learner has already practiced, organized by travel situation with large emergency and repair controls.
- **Why now:** The product's end state is use during travel, where connectivity, cognitive load, and urgency differ from a normal study session.
- **Evidence:** This is an explicit product hypothesis rather than a signal from current usage data, but it follows directly from the travel-readiness mission and the existing phrase and TTS assets.
- **Fit:** A personal app can curate a small, high-confidence set rather than becoming a full phrasebook product.
- **Risk:** It may encourage reading from the screen instead of recall, and offline audio caching introduces browser and storage complexity.
- **First validation:** Build a static mobile prototype containing twelve practiced phrases across restaurant, transport, hotel, and emergency categories, then test it in airplane mode and under a timed lookup task.
- **Next skill:** `$prototype`.

## Why the top recommendation wins

The Spoken Can-do Loop is the smallest coherent build that advances the actual outcome rather than one subsystem.
It connects two already-implemented differentiators, produces better evidence for a future readiness map, and creates a natural consumer for adaptive transfer practice.
It also follows current market direction without copying it: large competitors provide generic AI conversations, while Japanese Learner can center a known learner's exact travel goals, prior coverage, and recovery needs.

The most important implementation boundary is to assess task completion, not accent or native-like pronunciation.
The existing speaking checker already makes that distinction by grading semantic correctness rather than pronunciation.
The first version should keep push-to-talk turns and avoid realtime voice infrastructure until the learning loop proves useful.

## Suggested first slice

1. Define one authored Can-do: “I can order one item, answer a simple follow-up, and recover from one misunderstanding at a restaurant.”
2. Add optional push-to-talk input to `mission-order-restaurant` by reusing the speaking upload and transcription boundary.
3. Grade each turn for communicative success with low-confidence ASR handled as “could not assess,” not “incorrect.”
4. Convert one observed miss into four fresh, source-linked Practice exercises.
5. Offer a later checkpoint variant with different wording and no English hints.
6. Record supported versus independent task completion without changing XP or claiming global readiness.

The validation target should be behavioral rather than engagement-only.
A promising result would be that at least two of three test learners complete the varied retry independently after initially needing support, while reporting that the feedback matched what they meant to say.

## Sources

- [Japanese Learner repository context](../../CONTEXT.md)
- [Strategic feature roadmap](../plans/feature-roadmap.md)
- [Learning Session core cycle](../plans/2026-05-26-learning-session-core-cycle.md)
- [Speaking exercise implementation plan](../plans/2026-05-19-speaking-exercise-type.md)
- [Japan Foundation: JF Standard overview](https://www.jfstandard.jpf.go.jp/summaryen/ja/render.do)
- [Japan Foundation: Can-do and task accomplishment](https://www.kyozai.jpf.go.jp/kyozai/help/about/jfscando/en/render.do)
- [ACTFL Proficiency Guidelines overview](https://www.actfl.org/proficiency-guidelines-overview)
- [Butler et al.: varied retrieval promotes transfer](https://pubmed.ncbi.nlm.nih.gov/29265856/)
- [Busuu Conversations](https://www.busuu.com/en/languages/language-learning-with-busuu-conversations)
- [Duolingo Max and Japanese Video Call availability](https://blog.duolingo.com/duolingo-max/)

## Focused decision

Use **Order at a Restaurant** for the first checkpoint unless the owner has an imminent transport-heavy trip where **Buy a Train Ticket** would provide a more realistic validation.

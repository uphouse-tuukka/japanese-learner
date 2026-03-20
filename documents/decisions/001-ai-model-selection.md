# Decision: AI Model Selection

**Date:** 2026-03-20  
**Status:** Decided — upgrade to gpt-4.1

## Context

The Japanese Learner app uses an AI model for two tasks:
1. **Session generation** — Structured JSON with lesson plan + exercises
2. **Session summaries** — Feedback after exercise completion

Quality of the AI output directly impacts the learning experience: lesson depth, exercise variety, translation accuracy, and cultural authenticity.

## Options Considered

| Option | Cost/session | Pros | Cons |
|---|---|---|---|
| Keep gpt-4o-mini | $0.0014 | Cheapest, working | Lower content quality, occasional schema issues |
| Upgrade to gpt-4.1-mini | $0.004 | Better JSON compliance | Only marginal content improvement |
| **Upgrade to gpt-4.1** | $0.019 | Best structured output, rich content | 14x cost increase |
| Upgrade to gpt-4o | $0.024 | Excellent content | 17x cost, slightly worse at structured output than 4.1 |
| Fine-tune custom model | Variable | Tailored to our format | Weeks of effort, higher ongoing costs |

## Decision

**Upgrade to gpt-4.1.**

## Rationale

1. Cost is not a constraint — 1,050 sessions/month at $20 budget is more than sufficient
2. Structured output reliability is noticeably better, reducing parsing failures
3. Content quality improvement is meaningful for a learning app where engagement matters
4. Zero migration effort — same SDK, same API, just change model string
5. Custom fine-tuning is not worth the effort at this scale

# AI Model Comparison for Japanese Learner

**Date:** 2026-03-20  
**Context:** Evaluating AI models for session generation (structured JSON lessons + exercises) and session summaries.

## Current Setup

- **Model:** OpenAI gpt-4o-mini
- **SDK:** openai v6.32.0
- **Avg tokens/session:** ~3,500 input + ~1,500 output (~5,000 total)
- **Temperature:** 0.3 (generation), 0.2 (summaries)
- **Budget:** $20/month, 50,000 tokens/day per user

## Model Comparison

| Model                     | Input $/1M | Output $/1M | Cost/Session | Sessions/$20 | JSON Quality | Content Quality | Migration Effort |
| ------------------------- | ---------- | ----------- | ------------ | ------------ | ------------ | --------------- | ---------------- |
| **gpt-4o-mini** (current) | $0.15      | $0.60       | ~$0.0014     | ~14,000      | Good         | Good            | —                |
| gpt-4.1-nano              | $0.10      | $0.40       | ~$0.001      | ~20,000      | Good         | Fair            | None (drop-in)   |
| gpt-4.1-mini              | $0.40      | $1.60       | ~$0.004      | ~5,000       | Very Good    | Good+           | None (drop-in)   |
| **gpt-4o**                | $2.50      | $10.00      | ~$0.024      | ~830         | Excellent    | Excellent       | None (drop-in)   |
| **gpt-4.1**               | $2.00      | $8.00       | ~$0.019      | ~1,050       | Excellent    | Excellent       | None (drop-in)   |
| o3-mini                   | $1.10      | $4.40       | ~$0.010      | ~2,000       | Excellent    | Very Good       | None (drop-in)   |
| Claude 3.5 Haiku          | $0.80      | $4.00       | ~$0.009      | ~2,200       | Good         | Good            | High (new SDK)   |
| Claude 3.5 Sonnet         | $3.00      | $15.00      | ~$0.033      | ~600         | Excellent    | Excellent       | High (new SDK)   |
| Gemini 1.5 Flash          | $0.075     | $0.30       | ~$0.0007     | ~28,000      | Fair         | Fair            | High (new SDK)   |
| Gemini 1.5 Pro            | $1.25      | $5.00       | ~$0.012      | ~1,650       | Very Good    | Very Good       | High (new SDK)   |

## Quality Assessment for This Use Case

### What matters for structured Japanese lesson generation:

1. **JSON schema compliance** — Must output exact field names consistently
2. **Content quality** — Lesson explanations, cultural notes, exercise creativity
3. **Instruction following** — Respecting level constraints, topic avoidance, exercise variety
4. **Linguistic accuracy** — Correct Japanese, romaji, and translations
5. **Accepted answer variety** — Generating natural alternative translations

### gpt-4o-mini (current)

- **Strengths:** Very cheap, fast, adequate for structured output with good prompting
- **Weaknesses:** Sometimes misses field names (caused our expectedAnswer bug), less creative exercises, fewer natural alternative translations, occasionally generates less rich cultural notes
- **Verdict:** Adequate with well-crafted prompts, but requires more prompt engineering to compensate

### gpt-4o

- **Strengths:** Significantly better instruction following, richer lesson content, more creative and varied exercises, better cultural context, more natural translations
- **Weaknesses:** 17x more expensive than current
- **Verdict:** Noticeable quality improvement, especially in lesson explanations and exercise variety. At ~830 sessions/$20, still very affordable for personal use.

### gpt-4.1

- **Strengths:** Best-in-class structured output, excellent instruction following, strong content quality, slightly cheaper than gpt-4o
- **Weaknesses:** 14x more expensive than current
- **Verdict:** Best balance of quality and cost. Structured output reliability is excellent — less likely to need prompt workarounds. At ~1,050 sessions/$20, very comfortable budget.

### o3-mini

- **Strengths:** Strong reasoning, good structured output
- **Weaknesses:** Optimized for reasoning tasks, overkill for content generation. 7x more expensive.
- **Verdict:** Not ideal for this use case — reasoning models add latency without proportional content quality gains for lesson generation.

## Is the Upgrade Worth It?

**Yes, for gpt-4.1.** Here's why:

1. **JSON reliability:** gpt-4.1 follows structured output schemas more reliably, reducing parsing failures
2. **Content richness:** Lesson explanations are more detailed, cultural notes more insightful
3. **Exercise creativity:** More varied and engaging exercise content
4. **Translation quality:** Better at generating natural accepted answer alternatives
5. **Cost is trivial:** At ~1,050 sessions/month for $20, even heavy daily use barely dents the budget
6. **Zero migration effort:** Same OpenAI SDK, just change the model string

The quality difference between gpt-4o-mini and gpt-4.1 is most noticeable in:

- Lesson explanation depth and clarity
- Cultural note authenticity
- Exercise prompt creativity (less formulaic)
- Number and quality of accepted translation alternatives

## Custom Model via Azure AI Foundry

### What it involves

1. Fine-tune gpt-4o-mini or gpt-4.1-mini on curated session examples
2. Deploy on Azure AI Foundry as a custom endpoint

### Requirements

- **Training data:** 500+ high-quality session JSON examples (manually curated)
- **Time investment:** 40-80 hours for data curation, training pipeline setup, evaluation
- **Training cost:** ~$5-25 per fine-tune run
- **Inference cost:** 2-3x the base model price
- **Azure hosting:** Provisioned deployment minimum ~$50+/month (always-on)

### Feasibility Assessment

| Factor                | Rating           | Notes                                                      |
| --------------------- | ---------------- | ---------------------------------------------------------- |
| Technical feasibility | ✅ Doable        | Standard fine-tuning pipeline                              |
| Data availability     | ❌ Major blocker | Need 500+ curated examples — weeks of work                 |
| Cost efficiency       | ❌ Poor          | Higher inference + hosting costs exceed base model savings |
| Quality improvement   | ⚠️ Marginal      | Well-prompted base models perform comparably               |
| Maintenance burden    | ❌ High          | Retraining needed as curriculum evolves                    |
| Time to production    | ❌ Weeks         | 40-80 hours of dedicated effort                            |

### Verdict: Not recommended

The effort-to-gain ratio is poor for a personal/small-group app. A well-prompted gpt-4.1 will deliver better results than a fine-tuned gpt-4o-mini, at lower total cost and zero maintenance.

Fine-tuning makes sense at scale (thousands of users, predictable patterns) — not here.

## Recommendation

**Upgrade to `gpt-4.1`** — change one line of code for meaningfully better content quality at a cost that's well within budget. Skip custom models entirely.

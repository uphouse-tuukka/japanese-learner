# AI Session Generation Guidelines

**Last updated:** 2026-03-20  
**Purpose:** Standards for AI-generated learning sessions. These guidelines inform prompt engineering and quality checks.

## Exercise Guidelines

### Titles

- Exercise titles must be **generic** and never reveal the answer
- Good: "Translate the phrase", "Choose the meaning", "Fill in the blank"
- Bad: "Choose the correct greeting for morning", "Translate 'thank you'"

### Accepted Answers

- Translation exercises must include **at least 3** accepted alternatives
- Include common synonyms, informal variants, and shorter forms
- Example: "Thank you very much" → also accept "Thank you", "Thanks a lot", "Thank you so much"

### Romaji

- **All Japanese text must include romaji** for beginner accessibility
- Format: "ありがとうございます (arigatou gozaimasu)"
- This applies to exercise prompts, lesson key phrases, and any user-facing Japanese

### Exercise Count

- Default session size: **10 exercises**
- Minimum valid: 5 (50% of target)
- Maximum: 12
- Mix exercise types within level constraints

## Content Standards

### Lessons

- Teach one focused topic per session
- Include practical, travel-relevant language
- Cultural notes should be authentic and specific
- Key phrases: 3-5 per lesson with japanese, romaji, english, usage

### Level Constraints

- **absolute_beginner:** multiple_choice + translation (ja→en only), difficulty 1-2
- **beginner:** + listening, translation both directions, difficulty 1-3
- **lower_intermediate:** all types, difficulty 2-4

### Personalization

- Never repeat topics from last 5 sessions
- Address recent weaknesses in exercise selection
- Follow prior next-steps from summaries
- Adjust difficulty based on recent accuracy (>80% increase, <50% reinforce)

## Model Configuration

- **Model:** gpt-4.1 (recommended upgrade from gpt-4o-mini)
- **Temperature:** 0.3 for generation, 0.2 for summaries
- **Output format:** JSON mode enabled

# AI Session Generation Guidelines

**Last updated:** 2026-08-04
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
- Structured exercise fields may split script and romanization when the schema has paired fields. For speaking exercises, `expectedAnswer` is Japanese script only and `expectedRomaji` is the matching romanization.
- Automatic speech-recognition transcripts preserve the learner's Japanese utterance without adding generated romaji; the paired expected-answer display supplies the existing romaji accessibility support.

### Fill-in-the-blank exercises

- `sentence` and `sentenceRomaji` must show a visible `____` placeholder where the missing Japanese/romaji answer belongs.
- `sentenceEnglish` must be the complete English meaning/context with no blank placeholder, so the learner knows what Japanese/romaji word to supply.
- Do not include the answer in the learner-visible Japanese/romaji sentence fields; keep it only in `answer` and `answerRomaji`.
- Set `blank` to `____` for generated exercises.

### Multiple-choice exercises

- The displayed `question` and `choices` must be self-contained without relying on hidden metadata fields.
- If choices are English-only meanings, the question itself must include the Japanese phrase with romaji; do not ask “What does this sentence mean?” unless the sentence is visible in the question.
- For “What does [Japanese phrase] mean?” questions, choices must be English-only meanings.
- For scenario, “Which phrase means [English]?”, “What is [English] in Japanese?”, or “Translate [English] into Japanese” questions, choices must be Japanese with romaji only.
- Never combine both sides in one option such as `これは何ですか (kore wa nan desu ka) = What is this?` because it gives away the answer.

### Speaking Exercises

- Speaking exercises are private learn/practice exercises only. Public portfolio challenge output must not include `speaking` or require microphone access.
- Raw audio is transient: validate it, send it for transcription/evaluation, then discard it. The transcript is stored as the learner's `answerText`; raw audio, confidence, and feedback are not persisted in the MVP.
- Shared voice assessment accepts server-owned communicative goals, natural alternatives, and semantic rubrics so Spoken Missions never need to receive those evidence rules from the browser.
- Spoken Mission assessment maps confident success to Accepted, confident semantic misses to Retry, and missing speech, provider failures, malformed responses, or low-confidence ambiguity to Could not assess.
- Voice-assessment diagnostics contain only sanitized operational metadata, and both transcription and grading retain existing token-usage accounting when the provider reports tokens.
- Grade transcript semantic correctness, not pronunciation scoring. Show the transcript and expected Japanese + romaji after processing.
- Transcription may receive the prompt, expected answer, romaji, and accepted alternatives as hints, but only to resolve close or ambiguous Japanese speech; it must not invent the expected answer when audio is clearly different.
- Speaking grading should be learner-friendly for non-native ASR transcripts: accept minor particle, kana/kanji, spacing, formality, clipped-politeness, and close-transcription differences when communicative intent remains intact. Still reject changed core meaning such as wrong objects, wrong actions, negation errors, or unrelated phrases.
- If a spoken answer is marked incorrect, the UI should make the transcript reviewable and allow retry before continuing without credit.
- Supported response kinds:
  - `situational_response`: learner speaks an appropriate Japanese response for the situation.
  - `translation_en_to_ja`: learner speaks a Japanese translation of an English prompt.
- Required speaking fields: `prompt`, `responseKind`, `expectedAnswer`, `expectedRomaji`, `acceptedAnswers`, `rubric`; optional `maxRecordingSeconds` is clamped to 5-20 seconds.
- `japaneseWritingEnabled` only controls typed Japanese-writing input. It does not block microphone-based spoken Japanese exercises.

### Exercise Count

- Default session size: **10 exercises**
- Minimum valid: 5 (50% of target)
- Maximum: 12
- Mix exercise types within level constraints

## Content Standards

### Coverage metadata authority

- A generated Learning Session must durably store its generated Topic Category, Lesson Topic, cultural note, structured Lesson Key Phrases, and optional app-selected Learning Objective identity with the planned server session before responding successfully.
- Completion must build Coverage Evidence metadata from the stored generated plan, not from browser-authored lesson fields.
- Missing, blank, altered, malformed, or resumed browser lesson data must not replace valid server-owned metadata.
- Legacy planned sessions without stored plan metadata may use the bounded compatibility fallback and must identify the resulting coverage as lower confidence.
- Completion retries must return the stored completion result without repeating coverage, result, token, XP, or journal side effects.

### Learning Journal lifecycle

- Exact Coverage Evidence remains correct when the advisory Learning Journal is missing, stale, truncated, or fails to update.
- After session finalization, journal generation, persistence, and provider token accounting must remain inside the supported request lifecycle.
- Vercel deployments register the guarded journal task with `@vercel/functions` `waitUntil`.
- Local and other non-Vercel runtimes await the guarded task before returning because they have no supported deferred lifecycle boundary.
- Journal generation or persistence failure is sanitized and non-fatal after the completed session is durable.
- Persistence must compare the journal snapshot used for generation with the current stored value, and a stale update must not overwrite newer Learning Journal state.
- Provider token accounting must still be attempted if journal persistence fails or detects a stale source snapshot.

### Review Evidence

- Review Candidates must represent current unresolved item-level weakness, not every historical mistake.
- Phrase Review Evidence is chronological: a later correct result for the exact Lesson Key Phrase resolves older wrong or mixed result evidence, while a later wrong or mixed result can reopen review.
- Lesson Topic Review Evidence requires multiple unresolved wrong item signals or an explicit structured review request.
- A later 100 percent accurate Learning Session for the exact Lesson Topic resolves older topic-level Review Evidence.
- One unrelated wrong exercise must not make every Lesson Key Phrase or the entire Lesson Topic reviewable.
- Free-text Learning Journal sections, learner-facing strengths or weaknesses, legacy next steps, and neutral handoff notes are advisory only and must never authorize repetition.
- A structured review request must name an exact current Lesson Topic or Lesson Key Phrase, include a specific unresolved reason, and explicitly request review.
- Summary generation must validate structured review targets against server-owned lesson coverage before persisting them.
- A generated intentional review must return a structured `intentionalReview` claim naming the exact selected Review Candidate type and identity, the selected Learning Objective identity, and a fresh transfer task.
- The curriculum validator must independently confirm that the claimed Review Candidate remains present in current chronological Review Evidence and belongs to the selected Learning Objective.
- Missing, stale, resolved, unrelated, journal-only, or mismatched review claims must fail curriculum validation with the stable `ineligible_review` reason code.
- Intentional review must use a materially fresh Lesson Topic and transfer task rather than duplicating the original treatment.
- The application must select a stable fresh transfer-context rail that was absent from the original treatment and construct the complete affirmative transfer task and context-grounded Lesson Topic that the generated plan must copy exactly.
- Planned Learning Session coverage must retain bounded server-generated lesson and exercise treatment text so the application can derive semantic context evidence for later review.
- Intentional review must fail closed when complete original treatment evidence is unavailable or every app-owned transfer context overlaps it.

### Lessons

- Teach one focused topic per session
- Include practical, travel-relevant language
- Cultural notes should be authentic and specific
- Key phrases: 3-5 per lesson with japanese, romaji, english, usage
- Every covered non-review Lesson Key Phrase is forbidden in the authoritative `lesson.keyPhrases` list and causes rejection and retry.
- A covered utility phrase may still appear naturally in explanations or exercise context when it is not declared as a newly taught Lesson Key Phrase.

### Topic Categories

- The Learn-cycle source order starts with `greetings_basics`, then `travel_essentials`, then scenario categories such as `food_dining`, `transport`, and `shopping`.
- `travel_essentials` is labeled Travel Essentials and means portable travel literacy, not a general bucket.
- It covers numbers, quantities, counters, time, dates, money, forms, contact details, Wi-Fi details, common signs, clarification phrases, and similar cross-scenario essentials.
- Teach recognition and comprehension first, then spoken survival phrases.
- Numbers and core portable basics should lead before dates, forms, contact details, Wi-Fi, and similar later essentials.

### Canonical Learning Objectives

- Every Topic Category uses an app-owned catalog of stable Learning Objective identities.
- The core travel-scenario catalogs separate ordering, menu clarification, dietary needs, transport stages, product discovery, purchase tasks, route finding, indoor navigation, check-in, accommodation services, and problem resolution into materially distinct communicative goals.
- Emergencies & Health separates symptom description, pharmacy help, medical access, emergency calling, accident response, property reports, and critical intake details.
- Social & Conversation builds beyond basic name and origin exchanges through expanded introductions, hobbies, small talk, travel experiences, compliments, invitations, and shared preferences.
- Sightseeing & Culture separates attraction access, cultural interpretation, photo help, site etiquette, activities, recommendations, and visitor announcements.
- Bars & Nightlife teaches venue-specific choices and boundaries such as serving style, alcohol-free requests, rounds, charges, karaoke, last order, and nightlife invitations instead of cosmetically repeating restaurant tasks.
- Each catalog entry declares its Topic Category, a stable communicative-goal key, a learner-facing description, and focused generation guidance.
- The application deterministically selects an uncovered Learning Objective or a currently eligible review objective after selecting the Topic Category.
- The model must copy the selected identity exactly and may vary the Lesson Topic wording without changing that identity.
- Coverage and validation use the stable identity, so semantic title variants such as saying where the learner is from and introducing their country of origin remain one objective.
- A mastered objective remains unavailable as fresh coverage across the learner's full parseable history.
- When a migrated category has no uncovered or review-eligible objective, selection moves deterministically to the next allowed category with viable work.
- Legacy completed sessions without a recognized Learning Objective identity remain exact topic and phrase Coverage Evidence and are not semantically guessed.

### Level Constraints

- **absolute_beginner:** multiple_choice + translation (ja→en only), difficulty 1-2
- **beginner:** + listening, translation ja→en only, difficulty 1-3
- **elementary:** adds fill_blank and speaking `situational_response`; translation remains ja→en only; no spoken translation yet
- **pre_intermediate and above:** all private exercise types, including typed translation both directions plus speaking `situational_response` and `translation_en_to_ja`

### Personalization

- Never repeat a covered canonical Learning Objective as fresh coverage, regardless of intervening-session count
- Only the explicitly selected and currently eligible Review Candidate may authorize intentional repetition.
- Keep exact Lesson Topic avoidance for compatibility categories and legacy history
- Address recent weaknesses in exercise selection
- Follow prior next-steps from summaries
- Adjust difficulty based on recent accuracy (>80% increase, <50% reinforce)
- Record provider token usage with no session id for every returned generation response rejected during parsing, normalization, or curriculum validation.

## Model Configuration

- **Model:** gpt-5.4 for Learn session generation and summaries
- **Temperature:** 0.3 for generation, 0.2 for summaries
- **Output format:** JSON mode enabled

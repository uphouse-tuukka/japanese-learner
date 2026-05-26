# Japanese Learner Context

Japanese Learner helps a small set of learners build practical Japanese travel readiness through guided learning sessions. This glossary defines the domain language used when discussing the learning loop; implementation details belong in plans and decisions, not here.

## Language

**Learning Session**:
A bounded tutor-led practice run containing a coherent lesson plan, exercises, feedback, and a session summary. A learner completes many Learning Sessions over time.
_Avoid_: lesson, quiz, drill when referring to the whole session.

**Topic Category**:
A broad travel-readiness area such as food, transport, shopping, or accommodation. A Topic Category contains many possible Lesson Topics.
_Avoid_: topic when the broad curriculum bucket is meant.

**Lesson Topic**:
The specific situation or theme practiced inside a Learning Session, within one Topic Category.
_Avoid_: category, exercise title.

**Lesson Topic Identity**:
Whether two Lesson Topic references count as the same covered situation. Lesson Topic Identity is narrower than belonging to the same Topic Category: a genuinely different situation in the same category can be fresh coverage, while a reworded version of the same situation is repetition.
_Avoid_: category similarity when exact topic repetition is meant.

**Lesson Key Phrase**:
A phrase the Learning Session deliberately teaches or rehearses as part of the current Lesson Topic. It should be treated as covered once taught, unless later evidence shows it needs review.
_Avoid_: vocabulary item when referring to the highlighted teaching phrase.

**Phrase Identity**:
Whether two Lesson Key Phrase references count as the same covered phrase. Phrase Identity is narrower than semantic similarity: neighbouring phrases with similar English uses remain distinct unless the Learning Session deliberately frames them as review or contrast.
_Avoid_: semantic duplicate when only the exact taught phrase is meant.

**Category Rotation**:
The curriculum progression pattern that balances depth in the current Topic Category with coverage across other Topic Categories.
_Avoid_: random category choice, topic avoidance.

**Category Depth**:
Deliberate continuation in the same Topic Category across adjacent Learning Sessions so the learner gets more than a single shallow pass before rotating.
_Avoid_: accidental category repetition.

**Learning Journal**:
The cumulative learner record used to interpret learner progress, persistent strengths, weaknesses, and recommended next focus. It is advisory tutor memory, not the authoritative ledger of exact coverage.
_Avoid_: session summary, transcript, memory, coverage ledger.

**Coverage Evidence**:
Exact evidence from completed Learning Sessions about what Topic Categories, Lesson Topics, and Lesson Key Phrases were covered, plus recency and performance signals. Coverage Evidence is authoritative for avoiding accidental repetition.
_Avoid_: journal note, model memory.

**Review Candidate**:
Covered material that is worth repeating because learner performance or tutor interpretation suggests useful reinforcement. A Review Candidate explains intentional repetition.
_Avoid_: repeated content, stale topic.

## Example dialogue

Dev: “The next Learning Session is in food and dining again.”
Domain expert: “Food and dining is the Topic Category. What is the Lesson Topic?”
Dev: “Ordering at a ramen shop, and the Lesson Key Phrase is ‘sumimasen’.”
Domain expert: “If ‘sumimasen’ was already covered, Coverage Evidence should make that visible so the next Learning Session can either review it deliberately as a Review Candidate or choose a fresher phrase. The Learning Journal can explain whether the learner still needs politeness practice.”

## Flagged ambiguities

None currently.

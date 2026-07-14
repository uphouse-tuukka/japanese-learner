# Domain Documentation

Japanese Learner is a single-context repository.

## Before exploring

Read these sources when relevant:

- Root `CONTEXT.md` for the project glossary and preferred domain language.
- `documents/INDEX.md` for the status of plans, analyses, and decisions.
- Relevant decisions under `documents/decisions/`.
- Relevant active plans under `documents/plans/`.

If a referenced domain source does not exist, proceed without suggesting that it be created upfront.
The producer workflow creates domain documentation when real terminology or architectural decisions are resolved.

## Layout

```text
/
├── CONTEXT.md
├── documents/
│   ├── INDEX.md
│   ├── decisions/
│   └── plans/
└── src/
```

## Vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, specifications, tickets, tests, and implementation notes.

Do not replace established terms with near-synonyms that the glossary explicitly avoids.

If a required concept is missing or ambiguous, reconsider whether new language is necessary and record genuine gaps for `grill-with-docs`.

## Decision conflicts

If proposed work contradicts a decision under `documents/decisions/`, identify the conflict explicitly instead of silently overriding it.

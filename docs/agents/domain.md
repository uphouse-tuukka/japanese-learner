# Domain docs

This is a single-context repository.
Engineering skills should use the repository's domain documentation when exploring the codebase or publishing work.

## Before exploring

- Read the root `CONTEXT.md` for the project's domain language.
- Read relevant decision records under `documents/decisions/` before proposing or implementing changes in their areas.
- If `docs/adr/` is added later, also read any ADRs relevant to the work.

If an optional decision or ADR path does not exist, proceed without flagging its absence.

## Use the glossary's vocabulary

Use terms as defined in `CONTEXT.md` in issue titles, specifications, hypotheses, test names, and implementation notes.
Avoid synonyms that the glossary explicitly rejects.

If a needed concept is absent from the glossary, reconsider whether existing language already covers it or note the domain-language gap for later resolution.

## Flag decision conflicts

If proposed work contradicts an existing decision record, identify the conflict explicitly instead of silently overriding the decision.

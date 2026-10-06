# Contributing Guide - Japanese Learner

This document is the project workflow and policy guide for AI agents and human contributors.

## Project context

Japanese Learner is a personal Japanese learning app for travel readiness over a one-to-two-year horizon.
Its users are the owner and a few friends.
The stack is SvelteKit 2, Svelte 5 runes, TypeScript, Turso libsql, and the OpenAI API.
The app is hosted on Vercel and uses the warm Japanese washi design system in `src/app.css`.

## Before editing

Follow the entry sequence in `AGENTS.md`.
Inspect relevant source files and tests and identify the required validation before editing.
Keep work inside the requested scope.

## Branch and publication policy

For any project work in this repository, including documentation and agent-policy changes, work on a focused feature or fix branch or worktree rather than the default branch.
Make the change there, commit it, push it, and open one pull request against this repository.
Keep each change focused and reviewable.
Do not merge a pull request without explicit instruction.
Do not manually edit generated files or changelogs.
Do not add agent coauthors to commits.

## Validation and review

Follow `CODING_STANDARDS.md` for validation commands and documentation standards.
Run spec-compliance review before code-quality review.
Record the exact validation and review results in the handoff.

## Collaboration and maintenance

Use independent subagent lanes and coordinate before editing the same large file.
Preserve existing learning flows.
Maintenance and refactor work must not add user-facing features.
Put feature ideas, product redesigns, and nice-to-have improvements in the handoff.
Use this handoff format:

```text
Task:
Files changed:
Behavior changed: yes/no. If yes, explain.
Tests run:
Validation result:
Risks / follow-ups:
```

## Repository-local CodeGraph

CodeGraph is an optional, repository-local navigation aid for mapping unfamiliar code.
Use the guarded setup, exact queries, and guardrails in `documents/decisions/005-codegraph-repo-local-navigation.md`.
Treat its output as navigation guidance and verify findings in source and required validation.

## Documentation and domain references

Document significant decisions, plans, and analyses in these locations:

- Feature plans: `documents/plans/`.
- Architecture or tooling decisions: `documents/decisions/`, with an incrementing numeric prefix.
- Technical analyses or comparisons: `documents/analyses/`.
- AI prompt or session behavior changes: update `documents/plans/ai-session-guidelines.md`.

Use Markdown with a clear title, summary, and creation date for structured documents.
Decisions include alternatives and rationale; plans include implementation steps, affected files, and open questions.
Use the plan, decision, and review templates in `documents/templates/`.
Check `documents/INDEX.md` before following older plans.
Keep temporary debugging notes in the session workspace; trivial one-line fixes need no separate document.
Use `CONTEXT.md` and `docs/agents/domain.md` for project terminology.

## Architecture source

Use `README.md` and the relevant decisions for the current architecture map and learning-session data flow.

# Agent Instructions Restructuring

Created: 2026-10-06

This analysis records the three sequential passes used to simplify the repository's agent instructions.
The goal was to remove no-ops, apply progressive disclosure, and give each rule category one authoritative home.

## Passes

Pass 1 was the conservative extraction pass.
It moved implementation rules into `CODING_STANDARDS.md` and kept the root guide focused on startup and routing.

Pass 2 was the workflow consolidation pass.
It compacted the boot and contribution guidance and pointed architecture and CodeGraph readers toward their existing sources.

Pass 3 was the radical single-source pass recorded by this change.
It reduced `AGENTS.md` to mission, context-routing, scope, and policy pointers.
It made `documents/CONTRIBUTING.md` the owner of contribution, publication, collaboration, and documentation workflow.
It made `CODING_STANDARDS.md` the owner of implementation, exercise UI, AI, logging, audio, and validation rules.
It made `README.md` the owner of the architecture and learning-session map.
It made the CodeGraph decision the owner of CodeGraph commands and guardrails.

## Rule categories

Removed categories were generic boot prose, repeated status and inspection reminders, duplicated command lists, stale configuration or script summaries, and architecture detail repeated outside the architecture source.

Moved categories were coding constraints and validation commands into `CODING_STANDARDS.md`, contribution and publication workflow into `documents/CONTRIBUTING.md`, and CodeGraph procedure into `documents/decisions/005-codegraph-repo-local-navigation.md`.

Retained categories were the personal-app mission, preservation of existing learning flows, mandatory context routing, full validation by default, exercise frame and result guidance through the existing exercise guideline, romaji pairing for speech-recognition feedback, and publication, generated-file, coauthor, review, and subagent boundaries.

The resulting pointers describe both the material and the branch that triggers it.
The index and README project-docs list identify the new ownership so agents can reach the deeper references without loading them on every task.

## Progressive disclosure correction

The initial root pointer required the complete README and contribution guide for every edit.
The correction limits universal reading to the task and repository protection sections.
Setup, architecture, historical records, documentation workflow, and collaboration guidance now have explicit task triggers.

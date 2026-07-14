# Issue Tracker: GitHub

Issues, specifications, PRDs, and implementation tickets for this repository live in GitHub Issues under `uphouse-tuukka/japanese-learner`.

Use `gh-axi` for supported GitHub operations on this host.
Use `gh` only when the wrapper does not expose a required capability, such as a specialized GraphQL dependency operation.

## Conventions

- Create issues with `gh-axi issue create`.
- Read issues with `gh-axi issue view <number> --comments`.
- List issues with `gh-axi issue list` and appropriate state or label filters.
- Comment with `gh-axi issue comment <number>`.
- Apply or remove labels with `gh-axi issue edit <number>`.
- Close completed issues with `gh-axi issue close <number> --reason completed`.
- Preserve native blocking or parent-child relationships when a workflow creates dependent tickets.

Run commands inside the repository so the GitHub repository is inferred from the `origin` remote.

## Skill terminology

When a skill says “publish to the issue tracker,” create a GitHub issue.

When a skill says “fetch the relevant ticket,” read the issue body, comments, labels, and dependency relationships before acting.

# Issue tracker: GitHub

Issues and specs for this repository live as GitHub issues.
Use `gh-axi` on hosts where it is available, and fall back to the `gh` CLI when necessary.

## Conventions

- Create an issue with `gh-axi issue create --title "..." --body-file <path>`.
- Read an issue with `gh-axi issue view <number> --comments --full`.
- List issues with `gh-axi issue list`, adding appropriate state and label filters.
- Comment on an issue with `gh-axi issue comment <number> --body-file <path>`.
- Apply or remove labels with `gh-axi issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close an issue with `gh-axi issue close <number> --reason completed --comment "..."`.

Infer the repository from the Git remote when running commands inside this clone.

## Publishing work

When a skill says to publish a spec, PRD, ticket, or issue to the issue tracker, create a GitHub issue in this repository.

When a skill says to fetch a relevant ticket, read the full GitHub issue and its comments.

# Decision 004: Mission DB Constraints

**Date**: 2026-05-08
**Status**: Decided — keep mission FK/index schema unchanged for this batch

## Context

The database enables SQLite/libsql foreign-key enforcement with `PRAGMA foreign_keys = ON`, and older profile/session/progress tables declare foreign keys in their table definitions.

Mission-related tables do not consistently follow that convention:

- `missions` has no parent table and does not need a foreign key.
- `user_missions(user_id, mission_id)` does not declare foreign keys to `users(id)` or `missions(id)`.
- `user_badges(user_id, mission_id)` has `UNIQUE(user_id, mission_id)` but does not declare foreign keys to `users(id)` or `missions(id)`.
- `user_mission_limits(user_id, date)` uses `PRIMARY KEY(user_id, date)` but does not declare a foreign key to `users(id)`.

Current query-supporting indexes already exist for mission reads and joins: `idx_user_missions_user`, `idx_user_missions_mission`, `idx_user_badges_user`, and `idx_missions_category`.

Adding foreign keys to existing SQLite/libsql tables is not a metadata-only change. It requires rebuilding affected tables, copying data, recreating indexes, and deliberately handling any rows that reference missing users or missions. This slice did not include a deployed-data audit or evidence that orphan rows cannot exist.

## Decision

Do not add mission table foreign keys, drop indexes, or change mission-related index conventions in this batch.

Keep the current production schema unchanged. Any future enforcement of mission-table foreign keys must first include an orphan audit and an explicit table-rebuild migration plan that preserves data and documents how orphan rows are handled.

## Alternatives considered

| Alternative                                             | Pros                                                              | Cons                                                                                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add foreign keys to `CREATE TABLE IF NOT EXISTS` only   | Improves fresh database schemas with a small code change.         | Existing databases would keep the old table definitions, creating split schema behavior between fresh and deployed databases.                       |
| Rebuild mission tables now with foreign keys            | Aligns mission tables with older FK conventions immediately.      | Requires risky SQLite/libsql table rebuilds without an orphan audit, backup/staging validation, or a remediation policy for deployed data.          |
| Add only app-level checks for mission/user references   | Avoids table rebuild risk and can make write paths more explicit. | Does not solve schema inconsistency, can drift over time, and duplicates protections already present on the main route-layer write paths.           |
| Keep current schema and document the future safe path   | Avoids avoidable production-data risk while recording the debt.   | Leaves mission tables without DB-level referential enforcement until a deliberately planned migration is justified and validated.                   |
| Drop or consolidate current mission indexes immediately | Could simplify the schema if measurement showed redundancy.       | No query-plan or performance evidence was gathered in this slice; removing indexes could regress mission catalog, badge, or progress-related reads. |

## Rationale

- A `CREATE TABLE`-only foreign-key change would only affect new databases. Existing deployed SQLite/libsql databases would keep their current mission table definitions, which would split behavior across environments.
- Adding foreign keys to existing mission tables requires table rebuilds. Without orphan-row evidence and a remediation policy, that migration risks failed startup, blocked writes, or accidental data loss.
- The current mission indexes support the main mission queries and joins, so there is no low-risk index-only cleanup justified by the inspected code.
- The main mission write routes already validate core relationships before writing: mission start checks the selected user, user existence, mission existence, and unlock state; response checks that the loaded user mission belongs to the selected user and matches the route mission; completion checks selected/body user consistency and completes from the loaded user mission's `missionId` rather than accepting an arbitrary mission ID.
- For this personal app, preserving deployed data and avoiding startup/schema surprises is more important than making the mission schema cosmetically consistent in this batch.

## Consequences

- Mission progress, badges, and daily mission limits remain protected primarily by route-layer validation and application flow rather than DB-level foreign keys.
- Fresh and existing databases continue to use the same mission table definitions, avoiding a split-schema outcome.
- The inconsistent FK convention remains documented technical debt instead of being silently changed.
- Existing mission indexes remain in place until query measurements justify a cleanup.

## Follow-up tasks

- [ ] Before any future FK migration, run orphan detection queries for `user_missions.user_id`, `user_missions.mission_id`, `user_badges.user_id`, `user_badges.mission_id`, and `user_mission_limits.user_id`.
- [ ] Define a remediation policy for each orphan category, such as preserving rows under a recovered user, deleting impossible rows, or archiving them before enforcement.
- [ ] Prepare a SQLite/libsql table-rebuild migration that copies valid rows, recreates constraints and indexes, and fails safely if unexpected orphan rows remain.
- [ ] Validate the migration against a staging copy or backup before applying it to deployed data.
- [ ] Revisit mission index cleanup only after measuring query plans and read/write performance for the mission catalog, badge, progress, and daily-limit paths.

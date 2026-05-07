# Decision 003: Selected User API Boundary

**Date**: 2026-05-07
**Status**: Decided — enforce selected-user matches during route migrations

## Context

Profile-scoped write APIs accept a `userId` in the JSON body while the UI also stores the active profile in the `selected_user` cookie. During API boundary migrations, migrated routes need a consistent early check that prevents accidental writes for a different selected profile without breaking older clients that do not send the cookie.

## Decision

Migrated profile-scoped write routes may enforce that a present `selected_user` cookie matches the request body `userId` before performing generation, database writes, or token writes.

- If the `selected_user` cookie is absent, allow the request for compatibility.
- If the cookie is present and does not match the body `userId`, return `403 { ok: false, error: 'Selected user does not match request user.' }` before writes.
- Invalid or blank selected-user cookies remain request validation failures.
- This boundary check is not multi-tenant authorization and must not be treated as a complete auth model.

## Rationale

- Matches the UI's active-profile state for migrated write APIs.
- Reduces accidental cross-profile writes while preserving compatibility for clients without the cookie.
- Keeps the check small, explicit, and route-local during gradual migrations.

## Consequences

- Migrated profile-scoped write APIs may reject mismatched cookie/body requests that previously succeeded.
- Routes not yet migrated keep their previous behavior until handled in their own migration slice.
- A separate authentication/authorization design is still required if the app becomes multi-user or multi-tenant.

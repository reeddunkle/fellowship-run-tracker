# Decide where wire schemas live

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), split out of candidate 11. Strength: worth exploring.

## Problem

No rule decides which package owns a schema.

- Most HTTP payload schemas live in `packages/shared/src/*/*-api-schema.ts`, but the tracking schema lives in `packages/api-contract`.
- Only `packages/api-contract` uses `shared/meta/meta-api-schema.ts`.
- Only Electron uses some files in `packages/shared`: `app-state-rpc`, `renderer-log-entry-schema`, and `requirement-target-label`.

Without a rule, each new schema lands wherever its author guesses.

## Direction

One possible rule is that `packages/api-contract` owns every HTTP payload schema, `packages/shared` owns IDs and domain types used by more than one package, and code used by one app lives in that app. Record the rule as an ADR so later reviews and new code follow it.

## Open questions

- Is the rule above the right one? The alternative is to keep payload schemas next to their domain types in `packages/shared`.
- Does Electron's IPC contract (`app-state-rpc`) count as a wire schema that belongs in a contract package?
- Should a lint rule or knip setting enforce the rule?

## Done when

- An ADR in `docs/adr/` records the rule.
- Existing schemas follow it.

## Relevant code

- `packages/shared/src/*/*-api-schema.ts`
- `packages/shared/src/meta/meta-api-schema.ts`
- `packages/shared/src/app-state/app-state-rpc.ts`
- `packages/api-contract/src/application/fellowship-tracker/tracking-api-schema.ts`

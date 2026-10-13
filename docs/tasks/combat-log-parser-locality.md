# Keep the combat-log parser in one package and enable its JIT lazily

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 10. Strength: worth exploring.

## Problem

The combat-log parser is split across two packages. The event schemas and their registry live in `packages/shared`, but only `apps/api` imports them. The header schema, the line parser, and the JIT setup live in `apps/api`. `packages/shared` has no `test` script, so only the API tests cover the schemas.

Every entry point must call `enableFellowshipEventSchemaJit()` once. The CLI and Electron do this in their `main.ts`. If a new entry point forgets, parsing still works but runs slower, and nothing reports it.

`getEventType` runs a full header schema decode only to read `fields[1]`. When parsing fails, the error path splits the line a second time.

## Proposed change

- Move the event schemas and the registry into `apps/api/src/services/fellowship/parsing/`, or move the whole parser into `packages/shared`.
- Enable the JIT inside the parsing module on first use, and remove the explicit calls from the entry points and tests.
- Replace the header decode in `getEventType` with a lookup in a set of known event types.

## Tests

The fixture tests (interpreted and JIT) and the parse benchmarks stay as they are and guard the change. Tests no longer need to enable the JIT themselves.

## Relevant code

- `packages/shared/src/fellowship/validation/events/*`
- `packages/shared/src/fellowship/validation/fellowship-event-schema.ts`
- `apps/api/src/services/fellowship/parsing/*` (`get-event-type.ts`, `parse-fellowship-event-stream.ts` line 29)
- `apps/api/src/services/fellowship/validation/fellowship-header-schema.ts`
- `apps/cli/src/main.ts` (line 19)
- `apps/electron/src/main.ts` (line 35)

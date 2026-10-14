# Keep the combat-log parser in one package and enable its JIT lazily

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 10. Strength: worth exploring.

## Problem

The combat-log parser is split across two packages. The event schemas and their registry live in `packages/shared`, but only `apps/api` imports them. The header schema, the line parser, and the JIT setup live in `apps/api`. `packages/shared` has no `test` script, so only the API tests cover the schemas.

Every entry point must call `enableFellowshipEventSchemaJit()` once. The CLI and Electron do this in their `main.ts`. If a new entry point forgets, parsing still works but runs slower, and nothing reports it.

`getEventType` runs a full header schema decode only to read `fields[1]`. When parsing fails, the error path splits the line a second time.

## Direction

Keep the whole parser in one package, enable the JIT inside the parsing module on first use, and look up the event type without a full header decode. The existing fixture tests and parse benchmarks would guard the change.

## Open questions

- Should the parser live in `apps/api` or in `packages/shared`? Shared makes sense only if another app will parse logs.
- Does enabling the JIT lazily on first use cost anything measurable on the first parse?
- Do the benchmarks still need a way to run the interpreted path?

## Done when

- One package owns the event schemas, the registry, and the parser.
- No entry point or test has to enable the JIT.
- Parse benchmarks show no regression.

## Relevant code

- `packages/shared/src/fellowship/validation/events/`
- `packages/shared/src/fellowship/validation/fellowship-event-schema.ts`
- `apps/api/src/services/fellowship/parsing/` (`get-event-type.ts`, `parse-fellowship-event-stream.ts`)
- `apps/api/src/services/fellowship/validation/fellowship-header-schema.ts`
- `apps/cli/src/main.ts` (`enableFellowshipEventSchemaJit`)
- `apps/electron/src/main.ts` (`enableFellowshipEventSchemaJit`)

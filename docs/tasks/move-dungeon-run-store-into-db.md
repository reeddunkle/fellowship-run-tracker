# Move the dungeon-run store into packages/db

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 2. Strength: strong.

## Problem

Finishing a local run converts the run status into a method name and back three times:

1. `LocalLogDungeonRunPersistence` matches each processing event to `completeLocal`, `exitLocal`, or `interruptLocal`.
2. The repository turns each of those into `finishLocal(status)`. `finishLocal` then uses a nested ternary to pick a DAO method.
3. The DAO exposes `complete`, `exit`, and `interrupt`, which all call a private `finishRun(status)`.

Removing the six wrapper methods would lose no behaviour.

The repository also leaks in other ways:

- Local observations skip the repository. `LocalLogDungeonRunPersistence` calls `DungeonRunObservationDAO.observe` directly, outside the transaction that covers the lifecycle update. Fellowship Logs imports do go through the repository.
- `FellowshipTracker` depends on `DungeonRunObservationDAO` only to pass it along to persistence.
- Several repository methods only forward to a DAO: `startLocal`, `delete_`, `getFellowshipLogsDungeonRun`, and `listFellowshipLogsDungeonRuns`.
- `dungeon-run-repository-service.ts` provides the four DAO layers again, even though `makeDatabasePersistenceLayer` already provides them.
- The `timestamp` to `observedAt` mapping appears in both local persistence and the Fellowship Logs importer.
- `DungeonRunStatusSchema` lives in `packages/api-contract`. That import is the only reason `packages/db` depends on `@frt/api-contract`.

## Proposed change

Move the repository into `packages/db` as the dungeon-run store. Its interface works at the run level:

- `startLocal`
- `observeLocal(dungeonRunId, observations)`, which takes `DungeonRunObservation` values directly
- `finishLocal({ dungeonRunId, endedAt, status })`
- the existing read and delete operations

The DAO exposes one `finish({ dungeonRunId, status })`. Persistence maps each event type to a status in one place. Stop exporting the four per-table DAOs to the apps. Delete the unused `getByDungeonRunId`.

Move `DungeonRunStatusSchema` to `packages/shared/src/dungeon-run/`, next to the domain schemas, and drop `@frt/api-contract` from `packages/db/package.json`.

Update the `finishLocal` example in `docs/tracing.md` once the wrappers are gone.

## Tests

The db package can test the run lifecycle and its atomicity directly. One table of status cases against `finish` replaces three code paths. Today no DAO-level test covers local-log runs. The tracker harness can drop its `DungeonRunObservationDAO` fake. `interrupt-unfinished-dungeon-runs-job.test.ts` needs small renames.

This change gives [batch-dungeon-run-observation-inserts.md](batch-dungeon-run-observation-inserts.md) a single place to buffer and flush observations.

## Relevant code

- `apps/api/src/services/dungeon-run-repository/make-dungeon-run-repository-service.ts` (lines 100-170, 226, 244, 251)
- `apps/api/src/services/dungeon-run-repository/dungeon-run-repository-service.ts` (lines 133-138)
- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (lines 68, 103-145, 162-167)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-service.ts` (line 124)
- `apps/api/src/application/fellowship-logs-dungeon-run-importer/make-fellowship-logs-dungeon-run-importer-service.ts` (lines 55-61)
- `apps/api/src/layers/persistence-layer.ts`
- `packages/db/src/daos/local-log-dungeon-run/make-local-log-dungeon-run-dao.ts` (lines 54, 125-205)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts`
- `packages/db/src/models/local-log-dungeon-run-model.ts`
- `packages/api-contract/src/validation/dungeon-run/dungeon-run-status-schema.ts`

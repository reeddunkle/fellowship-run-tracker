# Move the dungeon-run store into packages/db

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 2. Strength: strong.

## Problem

Finishing a local run converts the run status into a method name and back again:

1. `LocalLogDungeonRunPersistence` matches processing events to `startLocal`, `completeLocal`, and `exitLocal`. A separate interrupt function calls `interruptLocal`, and the repository's `interruptUnfinishedLocal` calls it too.
2. The repository turns `completeLocal`, `exitLocal`, and `interruptLocal` into `finishLocal(status)`. `finishLocal` uses a nested ternary to pick a DAO method.
3. The DAO exposes `complete`, `exit`, and `interrupt`, which all call a private `finishRun(status)`.

Removing the six wrapper methods would lose no behaviour.

The repository also leaks in other ways:

- Local observations skip the repository. `LocalLogDungeonRunPersistence` calls `DungeonRunObservationDAO.observe` directly, outside the transaction that covers the lifecycle update. Fellowship Logs imports do go through the repository.
- `FellowshipTracker` depends on `DungeonRunObservationDAO` only to pass it along to persistence.
- Several repository methods only forward to a DAO: `startLocal`, `delete_`, `getFellowshipLogsDungeonRun`, and `listFellowshipLogsDungeonRuns`.
- `dungeon-run-repository-service.ts` provides the four DAO layers again, even though `makeDatabasePersistenceLayer` already provides them.
- Both local persistence and the Fellowship Logs importer map `timestamp` to `observedAt`.
- `DungeonRunStatusSchema` lives in `packages/api-contract`. Two imports of it are the only reason `packages/db` depends on `@frt/api-contract`.

## Direction

Move the repository into `packages/db` as a dungeon-run store with a run-level interface, roughly `startLocal`, `observeLocal`, `finishLocal` with a status, and the existing reads and deletes. Keep the per-table DAOs internal to `packages/db`. Map each processing event to a status in one place.

Move `DungeonRunStatusSchema` into `packages/shared` next to the other domain schemas, and drop the `@frt/api-contract` dependency and tsconfig references from `packages/db`.

## Open questions

- Which of today's repository methods belong on the store, and which belong to callers in `apps/api`?
- Only two integration tests call `LocalLogDungeonRunDAO.getByDungeonRunId` (`background-job-queue.test.ts` and `interrupt-unfinished-dungeon-runs-job.test.ts`). Should those tests read runs back through the store, or should the method stay as a test helper?
- Does `observeLocal` take a batch from the start, so that [batch-dungeon-run-observation-inserts.md](batch-dungeon-run-observation-inserts.md) changes only its caller?

## Done when

- Apps call one dungeon-run store. They don't import the per-table DAOs.
- Local observation writes and lifecycle updates go through the store.
- `packages/db` has tests for the local run lifecycle, one per status, grouped with nested `describe` blocks.
- `packages/db` no longer depends on `@frt/api-contract`.
- The `finishLocal` example in `docs/tracing.md` matches the new code.

## Relevant code

- `apps/api/src/services/dungeon-run-repository/make-dungeon-run-repository-service.ts` (`finishLocal`, `completeLocal`, `exitLocal`, `interruptLocal`, `interruptUnfinishedLocal`, `startLocal`)
- `apps/api/src/services/dungeon-run-repository/dungeon-run-repository-service.ts` (layer wiring)
- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (`persist`, the interrupt function)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-service.ts` (dependency on `DungeonRunObservationDAO`)
- `apps/api/src/application/fellowship-logs-dungeon-run-importer/make-fellowship-logs-dungeon-run-importer-service.ts` (`observedAt` mapping)
- `apps/api/src/layers/persistence-layer.ts`
- `packages/db/src/daos/local-log-dungeon-run/make-local-log-dungeon-run-dao.ts` (`finishRun`, `getByDungeonRunId`)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts` (`observe`)
- `packages/db/src/models/local-log-dungeon-run-model.ts`
- `packages/api-contract/src/validation/dungeon-run/dungeon-run-status-schema.ts`

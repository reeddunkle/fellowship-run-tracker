# Batch dungeon run observation inserts

## Problem

A `Persisted` run calls `DungeonRunStore.observeLocal` with a one-observation batch, about 3,400 times for Godfall Quarry. Each call opens its own SQLite transaction and runs one `DungeonRunObservationDAO.observe` insert, each with its own span.

## Direction

Buffer observations in `LocalLogDungeonRunPersistence` and pass each buffer to `observeLocal` as one batch. `observeLocal` already writes a batch in one transaction, so the first step changes only its caller. A multi-row insert in the store's `insertObservations` could follow. Flush before lifecycle writes (`startLocal`, `finishLocal`) and when tracking stops.

A crash loses whatever is still buffered. Crash recovery uses the latest persisted `observed_at` as the interrupted run's end time, so a large buffer makes that end time earlier than the real one.

## Open questions

- Should the flush trigger be a count, a time, or both? Weigh it against the crash-recovery cost above.
- Does the buffer live in persistence or inside the store?
- Is one transaction per batch enough, or does `insertObservations` also need a multi-row insert?

## Done when

- A run writes observations in batches, not one transaction per observation.
- Lifecycle writes and stopping tracking flush the buffer first.

## Relevant code

- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (`persist`, `finishLocalRun`)
- `packages/db/src/stores/dungeon-run/make-dungeon-run-store.ts` (`observeLocal`, `insertObservations`, `getUnfinishedLocalRunEndedAt`)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts` (`observe`)
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (stop and interrupt paths)

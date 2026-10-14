# Batch dungeon run observation inserts

## Problem

A `Persisted` run calls `DungeonRunObservationDAO.observe` once per observation, about 3,400 times for Godfall Quarry. Each call is a separate SQLite insert with its own `DungeonRunObservationDAO.observe` span.

## Direction

Buffer observations in `LocalLogDungeonRunPersistence` and write each batch with one multi-row insert or transaction. Flush before lifecycle writes (`startLocal`, `completeLocal`, `exitLocal`) and when tracking stops.

A crash loses whatever is still buffered. Crash recovery uses the latest persisted `observed_at` as the interrupted run's end time, so a large buffer makes that end time earlier than the real one.

Design this after [move-dungeon-run-store-into-db.md](move-dungeon-run-store-into-db.md). That task routes local observations through one store operation, which is where the buffering belongs.

## Open questions

- Should the flush trigger be a count, a time, or both? Weigh it against the crash-recovery cost above.
- Does the buffer live in persistence or inside the store?

## Done when

- A run writes observations in batches, not one insert per observation.
- Lifecycle writes and stopping tracking flush the buffer first.

## Relevant code

- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (`persist`)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts` (`observe`)
- `apps/api/src/services/dungeon-run-repository/make-dungeon-run-repository-service.ts` (`getUnfinishedLocalRunEndedAt`)
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (stop and interrupt paths)

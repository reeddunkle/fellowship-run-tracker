# Batch dungeon run observation inserts

Do [move-dungeon-run-store-into-db.md](move-dungeon-run-store-into-db.md) first. It routes local observations through one `observeLocal` operation, which is where the buffering belongs.

A `Persisted` run calls `DungeonRunObservationDAO.observe` once per observation, about 3,400 times for Godfall Quarry. Each call is a separate SQLite insert with its own `DungeonRunObservationDAO.observe` span.

Fix: buffer observations in `LocalLogDungeonRunPersistence` and write each batch with one multi-row insert or transaction. Flush before lifecycle writes (`startLocal`, `completeLocal`, `exitLocal`) and when tracking stops. A crash loses whatever is still buffered. Crash recovery uses the latest persisted `observed_at` as the interrupted run's end time, so a large buffer makes that end time earlier than the real one. Pick a flush trigger by count, time, or both with that cost in mind.

Relevant code:

- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (`persist`)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts` (`observe`)
- `apps/api/src/services/dungeon-run-repository/make-dungeon-run-repository-service.ts` (`getUnfinishedLocalRunEndedAt`)
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (stop and interrupt paths)

# Tasks

## Make `Tracking` status mean the log event stream is attached

`FellowshipTracker` reports `Tracking` when `FileMonitorSource.streamStatus` sees any `.txt` file in the log directory. That status comes from a different subscription than `Fellowship.liveEvents`, so `Tracking` does not mean the event stream has started or recorded its `streamStartedAt`.

`startTracking` also sets `WaitingForLogFile` before it forks the event stream, so that status doesn't mean the stream is attached either.

The live tracking e2e test (`apps/api/src/tests/e2e/live-tracking/`) works around this. After `WaitingForLogFile` arrives on `/tracking/events`, the replay creates an empty log file and waits 250 ms before appending lines (`LIVE_REPLAY_OPTIONS.initialDelayMilliseconds`). Replay timestamps start at the replay time, so a late pickup is safe as long as the event stream attaches within that window.

Fix: emit `Tracking` only after the live event stream has attached and chosen its starting offset, then remove the 250 ms initial delay from the live tracking test.

Relevant code:

- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (`startTracking`, `observeFellowshipLiveStatus`)
- `apps/api/src/services/fellowship/fellowship-service.ts` (`liveEvents`, `liveStatus`)
- `apps/api/src/services/filesystem/file-monitor-service.ts` (`streamLatestFileLines`, `streamStartedAt`)
- `apps/api/src/services/filesystem/file-monitor-source-service.ts` (`streamStatus`)

## Batch dungeon run observation inserts

A `Persisted` run calls `DungeonRunObservationDAO.observe` once per observation, about 3,400 times for Godfall Quarry. Each call is a separate SQLite insert with its own `DungeonRunObservationDAO.observe` span.

Fix: buffer observations in `LocalLogDungeonRunPersistence` and write each batch with one multi-row insert or transaction. Flush before lifecycle writes (`startLocal`, `completeLocal`, `exitLocal`) and when tracking stops. A crash loses whatever is still buffered. Crash recovery uses the latest persisted `observed_at` as the interrupted run's end time, so a large buffer makes that end time earlier than the real one. Pick a flush trigger by count, time, or both with that cost in mind.

Relevant code:

- `apps/api/src/application/dungeon-run-processing/local-log-dungeon-run-persistence.ts` (`persist`)
- `packages/db/src/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts` (`observe`)
- `apps/api/src/services/dungeon-run-repository/make-dungeon-run-repository-service.ts` (`getUnfinishedLocalRunEndedAt`)
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (stop and interrupt paths)

## Disconnect LiveSplit when the setting is turned off

`isLiveSplitEnabled` only affects the renderer. Turning it off hides the LiveSplit panel and stops the renderer's LiveSplit event subscription. If the user connects LiveSplit and then turns the setting off, the server's `LiveSplitGateway` stays connected and `LiveSplit.handleRunEvent` keeps sending reset, start, split, and pause commands to LiveSplit.

Fix: when a settings update changes `isLiveSplitEnabled` from true to false, call `LiveSplitGateway.disconnect` on the server. Decide whether this belongs in the settings save path or in a subscription to settings changes owned by `LiveSplit`.

Relevant code:

- `apps/api/src/services/app-settings/app-settings-service.ts`
- `apps/api/src/services/live-split-gateway/live-split-gateway-service.ts` (`disconnect`)
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx`

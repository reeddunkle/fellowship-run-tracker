# Make `Tracking` status mean the log event stream is attached

[unify-live-log-stream.md](unify-live-log-stream.md) covers this fix as part of a larger change. If that task lands first, close this one.

`FellowshipTracker` reports `Tracking` when `FileMonitorSource.streamStatus` sees any `.txt` file in the log directory. That status comes from a different subscription than `Fellowship.liveEvents`, so `Tracking` does not mean the event stream has started or recorded its `streamStartedAt`.

`startTracking` also sets `WaitingForLogFile` before it forks the event stream, so that status doesn't mean the stream is attached either.

The live tracking e2e test (`apps/api/src/tests/e2e/live-tracking/`) works around this. After `WaitingForLogFile` arrives on `/tracking/events`, the replay creates an empty log file and waits 250 ms before appending lines (`LIVE_REPLAY_OPTIONS.initialDelayMilliseconds`). Replay timestamps start at the replay time, so a late pickup is safe as long as the event stream attaches within that window.

Fix: emit `Tracking` only after the live event stream has attached and chosen its starting offset, then remove the 250 ms initial delay from the live tracking test.

Relevant code:

- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (`startTracking`, `observeFellowshipLiveStatus`)
- `apps/api/src/services/fellowship/fellowship-service.ts` (`liveEvents`, `liveStatus`)
- `apps/api/src/services/filesystem/file-monitor-service.ts` (`streamLatestFileLines`, `streamStartedAt`)
- `apps/api/src/services/filesystem/file-monitor-source-service.ts` (`streamStatus`)

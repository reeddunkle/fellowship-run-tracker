# Carry tracking status and log events on one live log stream

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 1. Strength: strong.

## Problem

The tracker gets its status and its events from two separate subscriptions to the log directory.

Status takes this path:

1. `FileMonitorSource.streamStatus` emits `WAITING_FOR_FILE` or `MONITORING`.
2. `Fellowship.liveStatus` renames those to `WaitingForLogFile` and `MonitoringLogFile`.
3. `observeFellowshipLiveStatus` turns them into `setTracking` and `setWaitingForLogFile` calls.
4. `createTrackingApiStatus` maps the result for the API.

Events come from `Fellowship.liveEvents`, which goes through `FileMonitor.streamLatestFileLines` to its own `FileMonitorSource.streamLatestFile` subscription. Both subscriptions share one directory watcher, but each one rescans the directory on every watch event.

### Known bug

`FellowshipTracker` reports `Tracking` when `FileMonitorSource.streamStatus` sees any `.txt` file in the log directory. That status comes from a different subscription than `Fellowship.liveEvents`, so `Tracking` doesn't mean the event stream has started or recorded its start time (`streamStartedAtMilliseconds`).

`startTracking` forks the event stream first, but the stream waits on a gate until `WaitingForLogFile` is set. So `WaitingForLogFile` doesn't mean the stream is attached either.

The live tracking e2e test works around this. After `WaitingForLogFile` arrives on `/tracking/events`, the replay creates an empty log file and waits 250 ms before appending lines (`LIVE_REPLAY_OPTIONS.initialDelayMilliseconds`). Replay timestamps start at the replay time, so a late pickup is safe as long as the event stream attaches within that window.

### Pass-throughs in the same modules

- `FileMonitor.findLatestFile` only forwards to `FileMonitorSource`.
- Only `file-monitor-service.test.ts` uses `FileMonitor.readLines`.
- Nothing uses `Fellowship.readEvents`. The only other mention is a stub in `fellowship-test-harness.ts`.
- `file-monitor-test-harness.ts` copies the `FileData` construction from `file-monitor-source-service.ts`.

## Direction

Have the live log stream emit status changes in the same stream as the lines, for example with three cases: `WaitingForFile`, `Attached { file, startOffset }`, and `Lines`. The tracker would set status from the first two and send `Lines` to the event processor. `streamStatus`, `liveStatus`, and `observe-fellowship-live-status.ts` would then have no reason to exist.

Remove the pass-throughs while these modules are open.

## Open questions

- Which module should own the tagged stream type, `FileMonitor` or `Fellowship`?
- Does anything other than the tracker read `streamStatus` or `liveStatus`?
- Should `Attached` fire again when the latest log file changes mid-session?

## Done when

- `Tracking` appears only after the event stream has attached and chosen its starting offset.
- The live tracking e2e test no longer needs its 250 ms initial delay.
- Status and events come from one subscription per tracking session.
- The tracker test harnesses no longer take a separate `liveStatus` option.

## Relevant code

- `apps/api/src/services/filesystem/file-monitor-source-service.ts` (`streamStatus`, `streamLatestFile`, `FileData` construction)
- `apps/api/src/services/filesystem/file-monitor-service.ts` (`streamLatestFileLines`, `findLatestFile`, `readLines`)
- `apps/api/src/services/fellowship/fellowship-service.ts` (`liveStatus`, `liveEvents`, `readEvents`)
- `apps/api/src/application/fellowship-tracker/observe-fellowship-live-status.ts`
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (`startTracking`)
- `apps/api/src/application/fellowship-tracker/create-tracking-api-status.ts`
- `apps/api/src/tests/common/harnesses/fellowship-tracker-test-harness.ts`
- `apps/api/src/tests/common/harnesses/fellowship-test-harness.ts`
- `apps/api/src/tests/common/harnesses/file-monitor-test-harness.ts`
- `apps/api/src/tests/e2e/live-tracking/`

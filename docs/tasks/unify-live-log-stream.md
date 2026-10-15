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

### Root cause of the race

`startTracking` sets `WaitingForLogFile` itself, before the forked event stream records `streamStartedAtMilliseconds` or subscribes to the directory watcher. If lines are written before the stream subscribes, `getContentStartedAt` sees content from before the stream started, so the stream starts at the end of the file and drops those lines.

## Design

Settled in design on 2026-10-15. It replaces the original Direction and Open questions.

### `FileMonitor`

- Rename `streamLatestFileLines` to `streamLatestFile`. It returns `Stream<LatestFileItem, PlatformError>`, where `LatestFileItem` is `WaitingForFile | Attached { file, startOffset } | Line { line }`. Emit one element per line. Effect streams are already chunked.
- Emit `WaitingForFile` and `Attached` only on transitions:
  - `WaitingForFile` once at the start if there's no file, and again if the attached file disappears. When the file disappears, also reset the read state.
  - `Attached` on the first file, and again on every switch, including truncation or replacement of the same path.
- Emit `WaitingForFile` only after the stream has recorded its start time and subscribed to the watcher. This fixes the race.
- Remove `findLatestFile` and `readLines`.

### `FileMonitorSource`

- Remove `streamStatus`. Keep `findLatestFile`, because `streamLatestFile` uses it internally.
- Export a shared `FileData` builder, and use it in `file-monitor-test-harness.ts`.

### `Fellowship`

- Replace `liveEvents` and `liveStatus` with `liveLog()`. It returns `Stream<FellowshipLiveLogItem, PlatformError>`, where `FellowshipLiveLogItem` is `WaitingForLogFile | AttachedLogFile { filePath, startOffset } | Event { event }`. Parse lines with the existing per-line parser.
- Narrow the error type to `PlatformError`, and drop the `FileMonitorError` alias if nothing else uses it.
- Remove `readEvents`. Keep `streamEvents` for `replayLog`.

### Tracker

- `StartTrackingOptions` takes `liveLog: Stream<FellowshipLiveLogItem>` and no longer has an optional `liveStatus`.
- `startTracking` sets a new `Starting` status. `WaitingForLogFile` and `Tracking` come only from the stream.
- A small function replaces `observe-fellowship-live-status.ts`. It takes the live log plus `setWaitingForLogFile` and `setTracking`, and returns `Stream<FellowshipEvent>` for the event processor. Test it on its own.
- `replayLog` passes `AttachedLogFile { startOffset: 0 }` followed by `Event`s built from `streamEvents`.

### API contract and renderer

- Add `Starting` to `TrackingApiStatus` and `createTrackingApiStatus`.
- The renderer shows "Starting tracker…" for `Starting`.
- Add an `isTrackingActive` helper in `stores/tracking/` that covers `Starting`, `WaitingForLogFile` and `Tracking`. Use it in `tracking-controls.tsx` and `tracking-start-stop-buttons.tsx`.

### Tests

- **`FileMonitor` integration tests.** Rewrite the `streamLatestFileLines` tests against the union. Add a regression test: once `WaitingForFile` has been observed, a file that is created and written to right away is read from offset 0. Also cover `Attached` on a file switch and `WaitingForFile` when the file is removed.
- **Tracker tests.** In `fellowship-tracker-status.test.ts`, drive a fake `liveLog`. Assert the order `Starting` → `WaitingForLogFile` → `Tracking`, and the return to `WaitingForLogFile` when the file is removed.
- **E2E test.** Remove the `initialDelayMilliseconds` key and pass 0 at the call site. Assert that the status after start is `Starting`, then wait for `WaitingForLogFile`.
- **Harnesses.** Replace `liveEvents` and `liveStatus` with a single `liveLog` option.
- The CLI `replay-log --initial-delay` flag stays.

## Done when

- `startTracking` reports `Starting`. `WaitingForLogFile` and `Tracking` come only from the live log stream.
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
- `packages/api-contract/src/application/fellowship-tracker/tracking-api-schema.ts`
- `apps/electron/src/renderer/components/dashboard/tracking-controls.tsx`
- `apps/electron/src/renderer/components/tracking/tracking-start-stop-buttons.tsx`

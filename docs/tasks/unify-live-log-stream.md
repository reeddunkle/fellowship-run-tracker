# Carry tracking status and log events on one live log stream

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 1. Strength: strong.

## Problem

The tracker gets its status and its events from two separate subscriptions to the log directory.

Status takes this path:

1. `FileMonitorSource.streamStatus` emits `WAITING_FOR_FILE` or `MONITORING`.
2. `Fellowship.liveStatus` renames those to `WaitingForLogFile` and `MonitoringLogFile`.
3. `observeFellowshipLiveStatus` turns them into `setTracking` and `setWaitingForLogFile` calls.
4. `createTrackingApiStatus` maps the result for the API.

Events come from `Fellowship.liveEvents`, which calls `streamLatestFile` on its own. Each directory watcher event therefore triggers two scans. Because status and events come from different streams, `Tracking` can appear before the event stream has attached. `startTracking` also sets its initial status without knowing whether the stream has attached. This is the root cause of [tracking-status-after-stream-attaches.md](tracking-status-after-stream-attaches.md).

## Proposed change

Make `FileMonitor.streamLatestFileLines` emit a tagged stream with three cases: `WaitingForFile`, `Attached { file, startOffset }`, and `Lines`. `Fellowship.liveEvents` exposes that one stream. The tracker sets status from `WaitingForFile` and `Attached`, and sends `Lines` to the event processor.

Delete these:

- `FileMonitorSource.streamStatus`
- `Fellowship.liveStatus`
- `observe-fellowship-live-status.ts`

## Tests

The `liveStatus` option goes away from the tracker test harnesses. A single fake stream drives both status and events, so tests can't set up a status that disagrees with the events. The live tracking e2e test can drop its 250 ms initial delay (`LIVE_REPLAY_OPTIONS.initialDelayMilliseconds`).

## Relevant code

- `apps/api/src/services/filesystem/file-monitor-source-service.ts` (`streamStatus`, around lines 217-245)
- `apps/api/src/services/filesystem/file-monitor-service.ts` (`streamLatestFileLines`, `streamStartedAt`)
- `apps/api/src/services/fellowship/fellowship-service.ts` (`liveStatus`, `liveEvents`, around lines 87-117)
- `apps/api/src/application/fellowship-tracker/observe-fellowship-live-status.ts`
- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (`startTracking`, around lines 216-226)
- `apps/api/src/application/fellowship-tracker/create-tracking-api-status.ts`
- `apps/api/src/tests/common/harnesses/fellowship-tracker-test-harness.ts`
- `apps/api/src/tests/common/harnesses/fellowship-test-harness.ts`
- `apps/api/src/tests/e2e/live-tracking/`

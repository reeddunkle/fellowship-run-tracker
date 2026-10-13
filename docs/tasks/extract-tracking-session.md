# Extract a tracking session module from startTracking

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 5. Strength: worth exploring.

## Problem

The per-run tracking state is split between `make-fellowship-tracker-service.ts` and `fellowship-tracker-event-processor.ts`.

`startTracking` builds the state `Ref` and the optional persistence (`source._tag === "Persisted" ? ... : undefined`). It also defines `interruptActiveDungeonRun`, which reads the state's internals (`configuredRun.dungeonRun?.status !== "ACTIVE"`). The event processor takes the same `Ref` and the same `persistence | undefined` as arguments.

Both files contain their own copy of publishing (`publishDungeonRunState` with `provideService(DungeonRunWebSocketBroadcaster, ...)`) and of the catch-and-log error handling.

## Proposed change

Add a tracking session module that owns everything for one run:

- the state `Ref`
- persistence, which is a no-op when the source is External
- publishing to the WebSocket broadcaster
- LiveSplit
- failure classification, which absorbs `classify-tracking-failure.ts`

Its interface is `run(events)` and `interrupt(endedAt)`. `startTracking` then handles only the fiber, the semaphore, and the status.

This fits naturally after [unify-live-log-stream.md](unify-live-log-stream.md).

## Tests

The session can be tested on its own with a plain array of events. Tracker tests shrink to lifecycle and status.

## Relevant code

- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (lines 48-136)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-event-processor.ts` (lines 98-107)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-state.ts`
- `apps/api/src/application/fellowship-tracker/classify-tracking-failure.ts`

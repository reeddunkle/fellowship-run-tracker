# Extract a tracking session module from startTracking

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 5. Strength: worth exploring.

## Problem

The per-run tracking state is split between `make-fellowship-tracker-service.ts` and `fellowship-tracker-event-processor.ts`.

`startTracking` builds the state `Ref` and the optional persistence (`source._tag === "Persisted" ? ... : undefined`). It also defines `interruptActiveDungeonRun`, which reads the state's internals (`configuredRun.dungeonRun?.status !== "ACTIVE"`). The event processor takes the same `Ref` and the same `persistence | undefined` as arguments.

Both files contain their own copy of publishing (`publishDungeonRunState` with `provideService(DungeonRunWebSocketBroadcaster, ...)`) and of the catch-and-log error handling.

## Direction

A tracking session module could own everything for one run: the state `Ref`, persistence (a no-op when the source is External), publishing, LiveSplit, and failure classification from `classify-tracking-failure.ts`. Its interface might be as small as running a stream of events and interrupting the active run. `startTracking` would keep the fiber, the semaphore, and the status.

[unify-live-log-stream.md](unify-live-log-stream.md) changes what `startTracking` looks like, so design this after that task lands.

## Open questions

- Does LiveSplit belong inside the session, or should it subscribe to published run state?
- Who owns the tracking status once the session exists, the tracker or the session?
- Should External and Persisted sources be two session variants, or one session with a no-op persistence?

## Done when

- One module owns per-run state, persistence, and publishing.
- Tests can drive a session with a plain list of events.
- Tracker tests cover only lifecycle and status.

## Relevant code

- `apps/api/src/application/fellowship-tracker/make-fellowship-tracker-service.ts` (`startTracking`, `interruptActiveDungeonRun`)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-event-processor.ts` (`publishDungeonRunState`)
- `apps/api/src/application/fellowship-tracker/fellowship-tracker-state.ts`
- `apps/api/src/application/fellowship-tracker/classify-tracking-failure.ts`

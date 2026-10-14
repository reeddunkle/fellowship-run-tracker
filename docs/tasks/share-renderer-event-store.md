# Replace the four renderer event stores with one shared module

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 3. Strength: strong.

## Problem

The tracking, LiveSplit, dungeon-run, and background-job event stores repeat the same code, 584 lines in total. Each one has its own copy of:

- a `listeners` set with `emit` and `updateSnapshot`
- a `Match.type` split between `CONNECTION_STATE_CHANGED` and `MESSAGE_RECEIVED`
- a `makeRestartableBrowserProgram` block that runs the event stream, logs errors, and sets the `ERROR` state
- `subscribe` and `getSnapshot`

The copies have already drifted:

- The LiveSplit store starts its stream on the first subscriber and stops it on the last. The other three wait for an explicit `start()` call in `renderer/main.tsx` and never stop.
- Only the dungeon-run and background-job stores accept an injected `makeEventStream` and `queryClient`. The tracking and LiveSplit stores can't be tested in isolation, and they have no tests.
- Only the tracking store doesn't export its snapshot type.

The stream code underneath already shares one module, `api/make-api-event-stream.ts`. The store code above it doesn't.

## Direction

Write one event-store module that owns the listeners, connection state, error handling, and fiber lifecycle. Each feature would pass in its message reducer, its side effects such as query invalidation, and a start policy. The four `*-event-message-error.ts` classes could become one.

## Open questions

- Should every store use the same start policy, or does each feature choose? LiveSplit's settings check in `useLiveSplitServerState` depends on the answer.
- Should side effects such as query invalidation run inside the reducer or in a separate callback?

## Done when

- The four stores share one implementation of connection, error, restart, and listener handling.
- One test suite covers that shared behaviour.
- Each feature's message handling has its own tests, including tracking and LiveSplit.

## Relevant code

- `apps/electron/src/renderer/stores/tracking/tracking-event-store.ts`
- `apps/electron/src/renderer/stores/live-split/live-split-event-store.ts`
- `apps/electron/src/renderer/stores/dungeon-run/dungeon-run-event-store.ts`
- `apps/electron/src/renderer/stores/background-job/background-job-event-store.ts`
- `apps/electron/src/renderer/api/make-api-event-stream.ts`
- `apps/electron/src/errors/*-event-message-error.ts`
- `apps/electron/src/renderer/main.tsx` (the `start()` calls)
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx` (`useLiveSplitServerState`)

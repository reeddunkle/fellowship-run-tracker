# Replace the four renderer event stores with one shared module

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 3. Strength: strong.

## Problem

The tracking, LiveSplit, dungeon-run, and background-job event stores repeat the same code, about 580 lines in total. Each one has its own copy of:

- a `listeners` set with `emit` and `updateSnapshot`
- a `Match.type` split between `CONNECTION_STATE_CHANGED` and `MESSAGE_RECEIVED`
- a `makeRestartableBrowserProgram` block that runs the event stream, logs errors, and sets the `ERROR` state
- `subscribe` and `getSnapshot`

`tracking-event-store.ts` and `live-split-event-store.ts` differ only in a field name.

The copies have already drifted:

- The LiveSplit store starts its stream on the first subscriber and stops it on the last. The other three wait for an explicit `start()` call in `renderer/main.tsx` and never stop.
- Only the dungeon-run and background-job stores accept an injected `makeEventStream` and `queryClient`. The tracking and LiveSplit stores can't be tested in isolation, and they have no tests.

The stream code underneath already shares one module, `api/make-api-event-stream.ts`. The store code above it doesn't.

## Proposed change

Add `makeApiEventStore({ makeEventStream, initial, onMessage, start })`, where `start` is `"eager"` or `"onSubscribe"`. It owns the listeners, connection state, error handling, and the fiber lifecycle. Each feature passes only its message reducer and side effects, such as query invalidation. The four `*-event-message-error.ts` classes collapse into one error class that takes the store name.

Once this lands, the settings check in `useLiveSplitServerState` belongs in the LiveSplit store's start policy, and `TrackingEventStoreSnapshot` gets exported like the other snapshot types.

## Tests

One shared suite covers connecting, errors, restarts, and listeners. Each feature tests only its `onMessage` reducer as a pure function. The tracking and LiveSplit stores get coverage they don't have today.

## Relevant code

- `apps/electron/src/renderer/stores/tracking/tracking-event-store.ts`
- `apps/electron/src/renderer/stores/live-split/live-split-event-store.ts`
- `apps/electron/src/renderer/stores/dungeon-run/dungeon-run-event-store.ts`
- `apps/electron/src/renderer/stores/background-job/background-job-event-store.ts`
- `apps/electron/src/renderer/api/make-api-event-stream.ts`
- `apps/electron/src/errors/*-event-message-error.ts`
- `apps/electron/src/renderer/main.tsx` (lines 42-44)
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx` (lines 177-195)

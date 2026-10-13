# Gather Electron quit and window lifecycle into one module

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 9. Strength: speculative.

## Problem

Main-process quit and shutdown logic is spread across `main.ts`, `quit-cleanup.ts`, `window-state-tracking.ts`, `fatal-exit-flush.ts`, `exit-on-startup-failure.ts`, `settle-within.ts`, and `bootstrap.ts`. Several of these keep state at module level:

- `windowStateFlushes` and `hasFlushedWindowStateForQuit` in `window-state-tracking.ts`
- `registeredFlush` in `fatal-exit-flush.ts`
- a `WeakMap` in `detached-window-placement.ts`

The `activate` handler in `main.ts` creates a window without the theme or the second-instance focus handling that `runElectronApplication` sets up. The `session-end` and `before-quit` paths meet only inside `makeQuitCleanup`.

`trackWindowStateSaves` has no tests for debouncing, flushing on close, or skipping saves after quit. `quit-cleanup.test.ts` covers only the pure half of quit cleanup.

## Proposed change

Add one app lifecycle module, built from injected Electron event sources. It owns window registration, the window-state flush registry, the quit cleanup sequence, and the fatal-exit flush. The `activate` path creates windows the same way startup does.

Quit must never block or delay OS shutdown or logoff. Keep that requirement while restructuring.

The strength is speculative because the recent shutdown commits suggest this code works now. The gain is mostly testability.

## Tests

Tests can drive the lifecycle with a fake event source instead of resetting module globals. Window-state saving and both quit paths become testable.

## Relevant code

- `apps/electron/src/main.ts` (lines 39-120)
- `apps/electron/src/bootstrap.ts` (line 84)
- `apps/electron/src/application/quit-cleanup.ts`
- `apps/electron/src/application/window-state-tracking.ts` (lines 5-6)
- `apps/electron/src/application/fatal-exit-flush.ts` (line 5)
- `apps/electron/src/application/exit-on-startup-failure.ts`
- `apps/electron/src/application/settle-within.ts`
- `apps/electron/src/application/detached-window/detached-window-placement.ts` (line 24)

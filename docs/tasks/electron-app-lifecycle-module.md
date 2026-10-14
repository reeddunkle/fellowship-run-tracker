# Gather Electron quit and window lifecycle into one module

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 9. Strength: speculative.

## Problem

Main-process quit and shutdown logic is spread across `main.ts`, `quit-cleanup.ts`, `window-state-tracking.ts`, `fatal-exit-flush.ts`, `exit-on-startup-failure.ts`, `settle-within.ts`, and `bootstrap.ts`. Several of these keep state at module level:

- `windowStateFlushes` and `hasFlushedWindowStateForQuit` in `window-state-tracking.ts`
- `registeredFlush` in `fatal-exit-flush.ts`
- a `WeakMap` in `detached-window-placement.ts`

The `activate` handler in `main.ts` creates a window without the theme or the second-instance focus handling that `runElectronApplication` sets up. The `session-end` and `before-quit` paths meet only inside `makeQuitCleanup`.

`trackWindowStateSaves` has no tests for debouncing, flushing on close, or skipping saves after quit. `quit-cleanup.test.ts` covers only the pure half of quit cleanup.

## Direction

One app lifecycle module, built from injected Electron event sources, could own window registration, the window-state flush registry, the quit cleanup sequence, and the fatal-exit flush. The `activate` path would create windows the same way startup does.

Quit must never block or delay OS shutdown or logoff. Any restructuring keeps that requirement.

The strength is speculative because the recent shutdown commits suggest this code works now. The gain is mostly testability. The `activate` mismatch may be worth fixing on its own first.

## Open questions

- Is the `activate` mismatch a real bug on Windows, or does it only matter on macOS?
- Which Electron events need to be injectable for tests, and which can stay direct?
- Is testability alone enough reason to restructure code that recently became stable?

## Done when

- Tests can drive window-state saving and both quit paths without resetting module globals.
- Windows created on `activate` match windows created at startup.

## Relevant code

- `apps/electron/src/main.ts`
- `apps/electron/src/bootstrap.ts`
- `apps/electron/src/application/quit-cleanup.ts`
- `apps/electron/src/application/window-state-tracking.ts` (`trackWindowStateSaves`)
- `apps/electron/src/application/fatal-exit-flush.ts`
- `apps/electron/src/application/exit-on-startup-failure.ts`
- `apps/electron/src/application/settle-within.ts`
- `apps/electron/src/application/detached-window/detached-window-placement.ts`

# Separate the detached window's DOM work from its React code

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), split out of the quick wins. Strength: worth exploring.

## Problem

`detached-window.tsx` (407 lines) mixes DOM style copying and measurement, Effect resize loops, and React portal logic.

`DetachedWindowProvider` exposes seven members. Only `DetachedWindow` uses two of them, `setPortalContainer` and `setResizeToContent`.

The renderer (`detached-window.tsx`) and the main process (`handle-detached-window-open.ts`) both hardcode the `"detachedWindow=true"` string.

The detached window has no tests.

## Direction

Move the DOM helpers into a module without React so browser-mode tests can cover them. Keep the provider's internal plumbing private. Put the `detachedWindow` flag in `packages/shared/src/electron-renderer` so the renderer and main process share it.

## Open questions

- Which parts of the resize loop need a real browser to test, and which can run against plain DOM?
- Should the resize loop move with the DOM helpers or stay with the React code?

## Done when

- The DOM helpers have browser-mode tests.
- The provider's interface includes only what consumers outside the detached window use.
- One constant defines the `detachedWindow` flag.

## Relevant code

- `apps/electron/src/renderer/components/detached-window/detached-window.tsx`
- `apps/electron/src/renderer/components/detached-window/detached-window-provider.tsx`
- `apps/electron/src/application/window-open-handler/handle-detached-window-open.ts`
- `packages/shared/src/electron-renderer/`

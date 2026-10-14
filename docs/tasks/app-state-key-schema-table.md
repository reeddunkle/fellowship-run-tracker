# Declare AppState once as a key-to-schema table

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 7. Strength: worth exploring.

## Problem

Each of the 10 AppState operations is written out by hand in about 8 places:

1. `packages/shared/src/app-state/app-state-rpc.ts`
2. `AppStateStore`, with its `AppStateStoreShape`, the `AppStateUpdate` union, `applyAppStateUpdate`, 5 getters, and 5 setters (363 lines)
3. `AppState`, which has a duplicate 10-member shape
4. `app-state-service-layer.ts`, which only forwards calls except for `setTheme`
5. `ipc/handlers/app-state-handlers.ts`
6. `app-state-client.ts`, which repeats the response schema for each operation and passes `operation` even though it equals `rpcRequest._tag`
7. `browser-app-state-layer.ts`, which only forwards calls
8. `app-state-queries.ts` and `app-state-mutations.ts`

Adding one field means editing most of these files. The app also applies the theme twice, once at startup in `run-electron-application.ts` and again in the layer.

## Direction

Declare the state once as a table that maps each key to its schema, with a generic get and set. Derive the IPC handler, the renderer client, and the query options from that table. Apply the theme in one place.

## Open questions

- Effect RPC with a schema group, or a custom table? Effect RPC brings its own conventions to the IPC path.
- Some fields have side effects when set, such as the theme. Where do those hooks live in a generic design?
- Does every field need its own query key, or can one query hold all AppState?

## Done when

- Adding a field means adding one table entry plus any side effect it needs.
- One round-trip test covers the generic path.
- The app applies the theme in one place.

## Relevant code

- `packages/shared/src/app-state/app-state-rpc.ts`
- `apps/electron/src/services/app-state-store/app-state-store-service.ts`
- `apps/electron/src/services/app-state/app-state-service.ts`
- `apps/electron/src/services/app-state/app-state-service-layer.ts`
- `apps/electron/src/ipc/handlers/app-state-handlers.ts`
- `apps/electron/src/renderer/api/electron-ipc/app-state/app-state-client.ts`
- `apps/electron/src/renderer/services/app-state/browser-app-state-layer.ts`
- `apps/electron/src/renderer/api/app-state/app-state-queries.ts`
- `apps/electron/src/renderer/api/app-state/app-state-mutations.ts`
- `apps/electron/src/application/run-electron-application.ts`

# Decide where the renderer's API seam sits

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), quick wins section. Moved out of the quick wins because the fix needs design. Strength: worth exploring.

## Problem

Each of the 12 `renderer/api/*/*-client.ts` files holds one to seven methods. Each method yields `AppApiClient`, calls one endpoint, and wraps the call in `E.fn("XApiClient.method")`. None of them reshape the request or the response beyond building `params` or `payload`.

The clients have three kinds of callers:

- Query and mutation modules in five folders: `background-job`, `configuration`, `dungeon-run`, `fellowship-logs`, and `meta`.
- `fellowship-catalog-data-service.ts`, which uses the `ability`, `dungeon`, `encounter`, and `unit` clients.
- Providers and routes: `settings-provider.tsx` and `__root.tsx` use `app-settings`, `live-split-provider.tsx` uses `live-split`, and `tracking-provider.tsx` uses `tracking`.

Four browser integration tests call clients directly: `ability-client.test.ts`, `configuration-client.test.ts`, `encounter-client.test.ts`, and `unit-client.test.ts`.

Some client files also export argument types that other modules use, such as `ConfigurationIdArgs` and `DeleteImportedDungeonRunArgs`.

## Direction

Have callers use `AppApiClient` directly and delete the forwarding clients. Keep the span names on the query, mutation, and service functions that replace them.

## Open questions

- Should the seam be `AppApiClient` itself, the query and mutation modules, or a per-feature module that owns both?
- Should the catalog service and the providers move to react-query first, so the five-folder pattern covers every caller? This overlaps with [move-settings-to-react-query.md](move-settings-to-react-query.md) and [simplify-renderer-action-providers.md](simplify-renderer-action-providers.md).
- What should the four browser tests exercise once the clients are gone?
- Where do the shared argument types live?

## Done when

- No module exists only to forward calls to `AppApiClient`.
- Every renderer caller reaches the API through the same seam.
- The browser tests exercise that seam.

## Relevant code

- `apps/electron/src/renderer/api/*/*-client.ts`
- `apps/electron/src/renderer/api/*/*-queries.ts` and `*-mutations.ts`
- `apps/electron/src/renderer/services/app-api-client/app-api-client.ts`
- `apps/electron/src/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service.ts`
- `apps/electron/src/renderer/components/providers/settings-provider.tsx`
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx`
- `apps/electron/src/renderer/stores/tracking/tracking-provider.tsx`
- `apps/electron/src/tests/browser/integration/api/`

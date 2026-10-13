# Quick wins from the 2026-10-13 architecture review

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), quick wins section.

Each item is small and independent. Check an item off when it lands.

## Dead code and stale scripts

- [ ] Delete `FellowshipLogsGateway.streamEvents` from the live and fixture gateways. Nothing calls it. Only `fellowship-logs-analytics.test.ts:16` uses `getReport`. This overlaps with [fixture-gateway-on-query-seam.md](fixture-gateway-on-query-seam.md).
- [ ] Delete `getByDungeonRunId` from `make-local-log-dungeon-run-dao.ts`. Nothing outside the DAO calls it.
- [ ] Delete `tools/dev-scripts/src/get-event-type-set.js`, or make it a CLI subcommand next to `filter-log` and `split-log`. Nothing references it, and its usage message names the wrong file (`list-event-types.js`).
- [ ] Remove the root `format:sql` script (`prettier --write` with no target, and nothing references it). `format:db-sql` is a pass-through alias.

## Duplication

- [ ] `tests/integration/application/tracking/fellowship-tracker-livesplit/configuration.ts` and `fellowship-tracker-websocket/basic-test/configuration.ts` are identical (116 lines each). Share one file.
- [ ] Both `FellowshipLogs.queueDungeonRunImport` and `make-fellowship-logs-dungeon-run-importer-service.ts:23-34` check whether a run is already imported. Keep the importer's check, since it runs right before the write.
- [ ] `dungeon-run-websocket-broadcaster.test.ts:21` calls `makeApiServerTestLayer(ApiServicesTest)`. That is the same as the exported `ApiServerTest`.
- [ ] Renderer `detached-window.tsx:294` and main `handle-detached-window-open.ts:5` both hardcode the `"detachedWindow=true"` string. Move it to `packages/shared/src/electron-renderer`.
- [ ] `ALL_FELLOWSHIP_EVENT` in `apps/api` partly duplicates `FELLOWSHIP_EVENT` in shared, and knip ignores it.

## Naming and conventions

- [ ] `file-monitor-test-harness.ts:209` exports `FileMonitorTestDependenciesLive = NodePlatformLayer`, but line 180 defines a local with the same name and a different meaning. Rename one of them.
- [ ] `classify-tracking-failure.ts` uses `Match` for a single case. Replace it with an `if`, or fold it into [extract-tracking-session.md](extract-tracking-session.md).
- [ ] Seven providers use `<Ctx.Provider value>` and two use the React 19 form `<Ctx value>` (`detached-window-provider.tsx`, `dungeon-run-table.tsx`). Pick one.
- [ ] Add the missing `.ts` extension to the `app-api-client` import in all 12 `*-client.ts` files, and to the imports in `renderer/main.tsx:11`, `dashboard-page.tsx:10-12`, and `dungeon-run-timer.tsx:5`.
- [ ] `renderer/main.tsx` has a `QueryClientProvider` import at line 19 that splits the import block.
- [ ] Remove the six `errors.length > 0` guards around `FieldError` (for example `settings-editor.tsx:168`, `217`, `243`). `FieldError` already returns null when there are no errors.
- [ ] Most `renderer/api/*/*-client.ts` files contain one to seven methods that each only forward to `AppApiClient`. Consider having the query and mutation modules use `AppApiClient` directly.

## Detached window

- [ ] `DetachedWindowProvider` exposes seven members, including `setPortalContainer` and `setResizeToContent`, which only `DetachedWindow` uses. Keep those private.
- [ ] `detached-window.tsx` (407 lines) mixes DOM style copying and measurement, Effect resize loops, and React portal logic. Move the DOM helpers into a module without React so browser-mode tests can cover them. The detached window has no tests today.

## Config and checks

- [ ] Root `tsconfig.json` references leave out `packages/db`, `packages/json-schemas`, and `apps/cli`. `tsconfig.packages.json` includes them.
- [ ] Nothing checks that `packages/json-schemas/generated/milestone-configuration.json` or the catalog checksums are up to date. Add a step to `check` that regenerates them and runs `git diff --exit-code`.

## Reviewed and left as is

- Biome, oxlint, and Prettier each have a distinct job. Prettier formats only embedded SQL, oxlint runs only the comment-policy and shadcn plugins, and Biome does the rest.
- The configuration DAO (with `configuration-persistence.ts`) and the background-job DAO already hide their complexity behind small interfaces.

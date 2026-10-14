# Quick wins from the 2026-10-13 architecture review

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), quick wins section.

Each item is small and independent. Check an item off when it lands. If an item turns out to need design, move it into its own task file.

## Dead code and stale scripts

- [ ] Delete `tools/dev-scripts/src/get-event-type-set.js`, or make it a CLI subcommand next to `filter-log` and `split-log`. Nothing references it, and its usage message names the wrong file (`list-event-types.js`).
- [ ] Remove the root `format:sql` script. It runs `prettier --write` with no target, and nothing references it. `format:db-sql` is a pass-through alias.
- [ ] Delete the unused `DungeonRunState` fields from `DungeonRunProvider`'s context: `eventConnectionState: DISCONNECTED`, `history: null`, `runState: null`, and `comparisonGroup`. `useDungeonRunContext` reads only the four milestone-expansion fields. The value for `DungeonRunSourcesContext` is a new object on every render, so memoize it too.

## Duplication

- [ ] `tests/integration/application/tracking/fellowship-tracker-livesplit/configuration.ts` and `fellowship-tracker-websocket/basic-test/configuration.ts` are identical (116 lines each). Share one file.
- [ ] Both `FellowshipLogs.queueDungeonRunImport` and the importer service check whether a run is already imported. Keep the importer's check, since it runs right before the write.
- [ ] `dungeon-run-websocket-broadcaster.test.ts` calls `makeApiServerTestLayer(ApiServicesTest)`, which is the same as the exported `ApiServerTest`.
- [ ] `ALL_FELLOWSHIP_EVENT` in `apps/api` partly duplicates `FELLOWSHIP_EVENT` in shared, and knip ignores it.

## Naming and conventions

- [ ] `file-monitor-test-harness.ts` exports `FileMonitorTestDependenciesLive = NodePlatformLayer`, and a local in the same file has the same name with a different meaning. Rename one of them.
- [ ] `classify-tracking-failure.ts` uses `Match` for a single case. Replace it with an `if`, or leave it for [extract-tracking-session.md](extract-tracking-session.md).
- [ ] Eight provider files use `<Ctx.Provider value>`, and two files use the React 19 form `<Ctx value>` (`detached-window-provider.tsx` and `dungeon-run-table.tsx`). Pick one.
- [ ] Add the missing `.ts` extension to the `app-api-client` import in the 12 `*-client.ts` files and `background-job-mutations.ts`, and to the imports in `renderer/main.tsx`, `dashboard-page.tsx`, and `dungeon-run-timer.tsx`.
- [ ] `renderer/main.tsx` has a `QueryClientProvider` import that splits the import block.
- [ ] Remove the six `errors.length > 0` guards around `FieldError`, five in `settings-editor.tsx` and one in `import-url-form.tsx`. `FieldError` already returns null when there are no errors. This overlaps with [move-settings-to-react-query.md](move-settings-to-react-query.md).
- [ ] Most `renderer/api/*/*-client.ts` files contain one to seven methods that each only forward to `AppApiClient`. Consider having the query and mutation modules call `AppApiClient` directly.

## Config and checks

- [ ] The root `tsconfig.json` references leave out `packages/db`, `packages/json-schemas`, and `apps/cli`. `tsconfig.packages.json` includes them.
- [ ] Nothing checks that `packages/json-schemas/generated/milestone-configuration.json` or the catalog checksums are up to date. Add a step to `check` that regenerates them and runs `git diff --exit-code`.

## Reviewed and left as is

- Biome, oxlint, and Prettier each have a distinct job. Prettier formats only embedded SQL, oxlint runs only the comment-policy and shadcn plugins, and Biome does the rest.
- The configuration DAO (with `configuration-persistence.ts`) and the background-job DAO already hide their complexity behind small interfaces.

# Replace copied boilerplate with shared helpers

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 11. Strength: worth exploring.

These are small, mechanical changes that can each land on their own.

## HTTP error mapping

"Log, then fail with `InternalServerError`" is written 12 times across 9 HTTP group files. `fellowship-logs-api-layer.ts` alone has four versions: `logInternalServerError`, `logGatewayFailure`, `mapGetFellowshipLogsDungeonRunsError`, and the inner generator in `mapDelete...`.

Add one `internalServerError(message)` helper that returns the error mapper.

## Catalog API groups and mocks

The `abilities`, `units`, and `dungeons` API layers are identical except for names. The same goes for the four catalog mocks in `tests/common/mocks/*-catalog-mock.ts`.

Add one catalog API group factory and one catalog mock factory.

## Tracking status mapping

`create-tracking-api-status.ts` spends 135 lines mapping `_tag` to `type` and `status`. Check whether it shrinks after [unify-live-log-stream.md](unify-live-log-stream.md).

## DAO errors and row decoding

There are eight copies of `mapXDAOError`, each with the same `instanceof` check that wraps anything else in `UnexpectedDatabaseError`. `mapConfigurationDAOError` is duplicated in the same folder, in `configuration-persistence.ts:81` and `make-configuration-dao.ts:42`. There are also about 15 `decodeXRows` helpers, and the error classes have identical bodies (`cause = reason` plus a `message` getter).

Add a generic `decodeRows(Model)` and a `wrapUnexpected` static on each error class.

These DAOs have no db-level tests: ability, app-setting, catalog-sync, encounter, unit, credential, live-split, local-log run, and Fellowship Logs dungeon run.

## Database wiring

`apps/cli/src/commands/setup-database-command.ts` repeats the four-database `mergeAll` that `makeDatabasePersistenceLayer` already builds. Adding a database means editing both. `Layer.unwrap(E.map(getDatabaseOptions(), ...makePersistenceLayer...))` also appears four times across the CLI and Electron.

Export `makeDatabasesLayer(options)` from `packages/db` and use it in both places. Add one config-driven persistence layer in `apps/api` for the CLI and Electron to share. `databases.test.ts` can cover `makeDatabasesLayer`.

## FileMonitor pass-throughs

- `FileMonitor.findLatestFile` only forwards to `FileMonitorSource`.
- Only tests use `FileMonitor.readLines` and `Fellowship.readEvents`.
- `file-monitor-test-harness.ts` copies the `FileData` construction from `file-monitor-source-service.ts`.

Remove the pass-throughs, and export a `toFileData(filePath, info)` helper from `filesystem.ts` for the harness to use.

## Wire schemas

Most HTTP payload schemas live in `packages/shared/src/*/*-api-schema.ts`, but the tracking schema lives in `packages/api-contract`. `shared/meta/meta-api-schema.ts` is used only by api-contract. Some shared files are used only by Electron: `app-state-rpc`, `renderer-log-entry-schema`, and `requirement-target-label`.

Put every `*-api-schema` file in `packages/api-contract` and keep IDs and domain types in `packages/shared`. Move the Electron-only files into `apps/electron`.

## Relevant code

- `apps/api/src/api/http/groups/**`
- `apps/api/src/api/http/groups/fellowship-logs/fellowship-logs-api-layer.ts`
- `apps/api/src/tests/common/mocks/*-catalog-mock.ts`
- `apps/api/src/application/fellowship-tracker/create-tracking-api-status.ts`
- `packages/db/src/daos/*/make-*-dao.ts`
- `packages/db/src/errors/*-dao-error.ts`
- `packages/db/src/database-persistence-layer.ts` (lines 50-76)
- `apps/cli/src/commands/setup-database-command.ts`, `serve-command.ts`, `generate-lss-command.ts`
- `apps/electron/src/runtimes/electron-runtime.ts` (lines 22-25)
- `apps/api/src/services/filesystem/file-monitor-service.ts` (lines 97-101, 204-210)
- `apps/api/src/services/filesystem/file-monitor-source-service.ts` (lines 136-147)
- `apps/api/src/tests/common/harnesses/file-monitor-test-harness.ts` (lines 87-104)
- `packages/api-contract/src/application/fellowship-tracker/tracking-api-schema.ts`

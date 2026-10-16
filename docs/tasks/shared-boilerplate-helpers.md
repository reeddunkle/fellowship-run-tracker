# Replace copied boilerplate with shared helpers

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 11. Strength: worth exploring.

These are small, mechanical changes. Each section can land on its own.

## HTTP error mapping

"Log, then fail with `InternalServerError`" is written 12 times across 9 HTTP group files. `fellowship-logs-api-layer.ts` alone has four versions: `logInternalServerError`, `logGatewayFailure`, `mapGetFellowshipLogsDungeonRunsError`, and an inner generator in `mapDelete...`.

Direction: one helper that takes a log message and returns the error mapper.

Open question: do any of the 12 sites log differently on purpose?

## Catalog API groups and mocks

The `abilities`, `units`, and `dungeons` API layers are identical except for names. `encounters` is the same apart from one extra `dungeonId` parameter. The four catalog mocks in `tests/common/mocks/*-catalog-mock.ts` follow the same pattern.

Direction: one factory for the four API layers and one for the four mocks.

Open question: can the factory handle the `encounters` parameter without getting harder to read than four copies?

## Tracking status mapping

`create-tracking-api-status.ts` spends 147 lines mapping `_tag` to `type` and `status`. The status model now has five cases: `Idle`, `Starting`, `WaitingForLogFile`, `Tracking` and `Failed`. All of them except `Idle` carry the same `dungeonId` and `source`.

## DAO errors and row decoding

There are nine `mapXDAOError` definitions under eight names, each with the same `instanceof` check that wraps anything else in `UnexpectedDatabaseError`. `mapConfigurationDAOError` is defined in both `configuration-persistence.ts` and `make-configuration-dao.ts`. There are also about 15 `decodeXRows` helpers, and the error classes have identical bodies (`cause = reason` plus a `message` getter).

Direction: a generic row decoder that takes a model, and one way to wrap unexpected errors that each error class shares.

These DAOs have no db-level tests: ability, app-setting, catalog-sync, encounter, unit, credential, live-split, local-log run, and Fellowship Logs dungeon run.

## Database wiring

`apps/cli/src/commands/setup-database-command.ts` calls `getDatabaseOptions` and repeats the four-database `mergeAll` that `makeDatabasePersistenceLayer` already builds, so adding a database means editing both. Three entry points build the persistence layer from database options on their own: `serve-command.ts`, `generate-lss-command.ts`, and `electron-runtime.ts`.

Direction: export the four-database layer from `packages/db`, and add one config-driven persistence layer that the CLI and Electron share.

## Done when

- Each section above either uses a shared helper or has a note explaining why the copies stay.

## Relevant code

- `apps/api/src/api/http/groups/`
- `apps/api/src/api/http/groups/fellowship-logs/fellowship-logs-api-layer.ts`
- `apps/api/src/tests/common/mocks/*-catalog-mock.ts`
- `apps/api/src/application/fellowship-tracker/create-tracking-api-status.ts`
- `packages/db/src/daos/*/make-*-dao.ts`
- `packages/db/src/daos/configuration/configuration-persistence.ts`
- `packages/db/src/errors/*-dao-error.ts`
- `packages/db/src/database-persistence-layer.ts` (`makeDatabasePersistenceLayer`)
- `apps/cli/src/commands/setup-database-command.ts`
- `apps/cli/src/commands/serve-command.ts`
- `apps/cli/src/commands/generate-lss-command.ts`
- `apps/electron/src/runtimes/electron-runtime.ts`

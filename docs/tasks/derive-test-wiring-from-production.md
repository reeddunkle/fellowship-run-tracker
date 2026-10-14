# Derive API test wiring from production wiring

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 6. Strength: worth exploring.

## Problem

The API test layers copy production wiring by hand, so every change to it has to be made twice.

- `api-server-test-layer.ts` lists the API services three times: in the `ApiServices` type, in `ApiServiceTestLayer`, and in the `mergeAll` call. The lists must stay in sync with the 10 services in `layers/api-services-layer.ts` plus `FellowshipTracker`, which `api-layer.ts` adds separately.
- `api-server-test-layer.ts` also repeats the WebSocket channel, broadcaster, and shutdown wiring from `layers/api-layer.ts`.
- `fellowship-tracker-test-harness.ts` (299 lines) hand-writes 11 `DungeonRunRepository` methods and 3 `DungeonRunObservationDAO` methods, plus fakes for `ConfigurationDAO` and LiveSplit.
- `fellowship-tracker-integration-test-harness.ts` rebuilds `Fellowship.layer` by hand.

Adding a repository method breaks harnesses that never call it.

## Direction

Tests could reuse a production wiring function that takes the HTTP server layer, derive the services type from `ApiServicesLayer`, and start from shared base fakes that each test overrides one method at a time.

[move-dungeon-run-store-into-db.md](move-dungeon-run-store-into-db.md) shrinks the fakes this task would share, so design this after that task lands.

## Open questions

- How far should test wiring follow production? Some tests may need to replace pieces that a shared wiring function hides.
- Should base fakes fail loudly on unexpected calls or return empty defaults?

## Done when

- Adding an API service changes production wiring only.
- Adding a repository method doesn't break tests that never call it.

## Relevant code

- `apps/api/src/tests/common/layers/api-server-test-layer.ts`
- `apps/api/src/layers/api-layer.ts`
- `apps/api/src/layers/api-services-layer.ts`
- `apps/api/src/tests/common/harnesses/fellowship-tracker-test-harness.ts`
- `apps/api/src/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts`
- `apps/api/src/tests/common/mocks/`

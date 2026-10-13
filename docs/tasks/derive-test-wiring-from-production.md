# Derive API test wiring from production wiring

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 6. Strength: worth exploring.

## Problem

The API test layers copy production wiring by hand, so every change to it has to be made twice.

- `api-server-test-layer.ts` lists the 11 API services three times: in the `ApiServices` type, in `ApiServiceTestLayer`, and in the `mergeAll` call. All three must match `layers/api-services-layer.ts`.
- `api-server-test-layer.ts` also repeats the WebSocket channel, broadcaster, and shutdown wiring from `layers/api-layer.ts`.
- `fellowship-tracker-test-harness.ts` (299 lines) hand-writes 14 repository methods, plus fakes for `ConfigurationDAO` and LiveSplit.
- `fellowship-tracker-integration-test-harness.ts` rebuilds `Fellowship.layer` by hand.

Adding a repository method breaks harnesses that never call it.

## Proposed change

- Export one production wiring function that takes the HTTP server layer, and use it in both `ApiLayer` and the test layer.
- Derive the services type with `Layer.Success<typeof ApiServicesLayer>` instead of writing it out.
- Put base fakes in `tests/common/mocks` that tests can override one method at a time.

[move-dungeon-run-store-into-db.md](move-dungeon-run-store-into-db.md) shrinks the repository fake, so do this one after it.

## Tests

Wiring changes happen in one place. Each test sets up only the methods it uses.

## Relevant code

- `apps/api/src/tests/common/layers/api-server-test-layer.ts` (lines 35-100)
- `apps/api/src/layers/api-layer.ts`
- `apps/api/src/layers/api-services-layer.ts`
- `apps/api/src/tests/common/harnesses/fellowship-tracker-test-harness.ts` (lines 167-243)
- `apps/api/src/tests/common/harnesses/fellowship-tracker-integration-test-harness.ts` (lines 45-48)

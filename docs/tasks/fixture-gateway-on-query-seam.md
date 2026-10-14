# Build the fixture gateway from a file-backed Query

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 4. Strength: strong.

## Problem

Two separate modules read the recorded Fellowship Logs fixtures (`metadata.json` and `page-N.json`).

`make-fellowship-logs-gateway-fixture.ts` (298 lines) reimplements every gateway method. Its `getReport` and `streamEvents` are near-copies of the live versions in `make-fellowship-logs-gateway-service.ts`. Because it doesn't go through the real gateway, fixture mode skips pagination, caching, and rate-limit tracking.

`controlled-fellowship-logs-fixture-layer.ts` (270 lines) reads the same files through a fake `Query` and passes it to `makeFellowshipLogsGatewayFromQuery`. The rate-limit tests use this approach too.

Nothing calls `FellowshipLogsGateway.streamEvents` in either the live or fixture gateway. Only `fellowship-logs-analytics.test.ts` calls `getReport`.

## Direction

Rebuild `FellowshipLogsGateway.fixtureLayer` as a file-backed `Query` passed to `makeFellowshipLogsGatewayFromQuery`, so the HTTP query and the file query sit at the same seam. The test layer would add failure injection on top. Delete `streamEvents` while making the change.

## Open questions

- Should fixture mode simulate rate-limit headers, or report no rate limit at all?
- Can the test layer's failure injection wrap the production file query, or does it need its own reader?
- Is `getReport` still worth keeping when only one test calls it?

## Done when

- Fixture mode runs through `makeFellowshipLogsGatewayFromQuery`.
- One module reads the recorded fixture files.
- `streamEvents` is gone from the gateway interface.

## Relevant code

- `apps/api/src/services/fellowship-logs-gateway/make-fellowship-logs-gateway-fixture.ts`
- `apps/api/src/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts` (`makeFellowshipLogsGatewayFromQuery`, `getReport`, `streamEvents`)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts` (`fixtureLayer`, `streamEvents`)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts`
- `apps/api/src/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts`

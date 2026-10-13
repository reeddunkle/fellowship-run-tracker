# Build the fixture gateway from a file-backed Query

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 4. Strength: strong.

## Problem

Two separate modules read the recorded Fellowship Logs fixtures (`metadata.json` and `page-N.json`).

`make-fellowship-logs-gateway-fixture.ts` (298 lines) reimplements every gateway method. Its `getReport` and `streamEvents` are near-copies of the live versions in `make-fellowship-logs-gateway-service.ts`. Because it doesn't go through the real gateway, fixture mode skips pagination, caching, and rate-limit tracking.

`controlled-fellowship-logs-fixture-layer.ts` (270 lines) reads the same files through a fake `Query` and passes it to `makeFellowshipLogsGatewayFromQuery`. The rate-limit tests use this approach too.

## Proposed change

Rebuild `FellowshipLogsGateway.fixtureLayer` as a file-backed `Query` passed to `makeFellowshipLogsGatewayFromQuery`. The HTTP query and the file query then sit at the same seam. The test layer adds failure injection on top of the file-backed query.

Delete `FellowshipLogsGateway.streamEvents` from both the live and fixture gateways at the same time. Nothing calls it.

## Tests

The change deletes about 300 lines. Fixture mode and tests exercise the same pagination, caching, and rate-limit code as production.

## Relevant code

- `apps/api/src/services/fellowship-logs-gateway/make-fellowship-logs-gateway-fixture.ts` (lines 227-258)
- `apps/api/src/services/fellowship-logs-gateway/make-fellowship-logs-gateway-service.ts` (lines 326-363)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts` (lines 125, 145-153)
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts`
- `apps/api/src/tests/common/layers/controlled-fellowship-logs-fixture-layer.ts`

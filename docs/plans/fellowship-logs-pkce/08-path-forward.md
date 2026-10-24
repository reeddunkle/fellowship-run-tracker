# Path forward

## Purpose

This document is the authoritative remaining-work ledger for the Fellowship Logs PKCE feature. The earlier documents retain provider evidence, implemented behavior, and the reasoning behind decisions. When an older requirement conflicts with this file, update the older document before implementing it.

Correctness and architectural refactors come before the remaining feature validation. Production-release evidence is a separate gate from implementation completion.

## Priority 0: correctness

### Make connection replacement confirmation atomic

Complete. The `replaceConnection` boolean alone used to confirm a connection observed before credential validation or browser authorization, so a concurrent change could replace a connection the user never confirmed. The generation contract now closes that gap:

- Every installed or replaced connection gets a new UUIDv4 generation from Effect `Crypto`, even when it reconnects the same profile and account. Token rotation, the reauthorization-required state, and point-system opt-in updates keep it.
- The display-safe connection response returns the generation as an opaque value.
- Start-authorization and save-own-client commands require `expectedGeneration`: the generation the renderer showed, or `null` when it showed no connection. `replaceConnection` remains the explicit intent to replace a different target.
- `FellowshipLogsConnectionManager` rejects a command whose `expectedGeneration` is no longer current before validating credentials or starting a sign-in. It then passes the same generation to the eventual write.
- `FellowshipLogsConnection.saveOwnClient` and `saveAuthorizedSession` compare the expected generation with the stored one inside the exclusive lease and database transaction. A mismatch fails with `FellowshipLogsConnectionChangedError` and leaves the newer connection in place.
- The pending authorization transaction stores the expected generation, so a sign-in completed after a restart is checked the same way. Installing a connection or disconnecting already deletes a pending transaction, so the stored generation guards the window after the callback consumes the transaction, while the code is exchanged and the user is read. A rejected completion discards the exchanged tokens and must be started again.
- The HTTP contract maps the error to `FellowshipLogsApiConnectionChangedError` (409) for start, completion, and save-own-client. The authorization status reports `FAILED` with `CONNECTION_CHANGED`.
- Tests cover a change during credential validation, including disconnect and an absent observed connection. They also cover a change during callback completion, including disconnect, an ABA re-authorization of the same account, an absent observed connection, and completion after a restart. HTTP and renderer tests cover the stale-confirmation error and status.

### Hold one lease for the point-system opt-in check

Complete. The check owns one request lease across profile validation, access selection, the provider request, response classification, and the conditional connection update. Its gateway query uses that lease instead of acquiring a nested lease. Profiles other than `FELLOWSHIP_RUN_TRACKER_USER` still return `NOT_REQUIRED` without a provider request. A concurrency regression pauses the provider response and proves that replacement waits until the result is applied, so the result cannot update the replacement connection.

### Correlate lookup and import cost by workflow

Complete. Each metadata lookup now creates an opaque UUIDv4 workflow record in the analytics database while holding the connection request lease. The record binds the exact measured lookup cost to the connection generation, report, fight, and a 30-minute expiry. The metadata response carries the ID into the persistent import-job payload.

A newly queued job claims its matching workflow atomically; an idempotent queue request that returns an existing job does not claim another. The runner may repeat that claim for the same job, which closes the race between queue persistence and worker execution. Missing, expired, already-claimed, or mismatched workflows never block an import: the cost observation excludes the lookup and emits only a reason tag. A completed attempt deletes its claimed record, and routine claims prune expired records plus claimed records older than seven days.

Tests cover concurrent lookups for the same fight, duplicate queue requests, restart between lookup and import, expiry, mismatch, already-claimed workflows, cleanup, and fail-open import accounting.

## Priority 1: simplify and realign boundaries

### Replace the partial GraphQL parser with query capabilities

Complete. Gateway queries are structured values containing the GraphQL document and an explicit `USER_POINT_ELIGIBLE` or `UNCLASSIFIED` capability. `makeQuery` requires the capability, and each reviewed production query declares user-point eligibility beside its document definition.

Strict mode rejects every unclassified query before sending an HTTP request. Default-spending profiles still accept unclassified queries, while directive-placement failures remain distinct. Provider-side point-policy error classification remains in place. The partial `findNonUserEligibleFields` parser and its parser-specific suite are gone; tests cover every strict production gateway query, fail-closed unclassified behavior, directive placement, endpoint selection, and spending policy.

### Finish domain cleanup

Complete. The client ID and secret schemas now live in the Fellowship Logs domain, and connection, OAuth, database, API-contract, CLI, renderer, and test imports use that boundary. The branch's new `switch` statements use exhaustive Effect matching or a typed data lookup, and the pass-through `getCompletedStatus` helper is inlined.

The generic background-job waiting and binding machinery remains at the generic queue boundary. `FellowshipLogsAuthorization` remains one cohesive state-machine module because its session scope, callback consumption, expiry, concurrency, and status publication share state.

### Retain fail-closed connection setup

Complete. BYO client credentials are validated before persistence, and provider rejection or unavailability leaves the prior connection unchanged. The renderer reports the operation error and offers no Save Anyway path. Persisted connection status, authorization-session status, and operation errors remain separate domains in the API contract and renderer.

Disconnect and replacement take the connection lease exclusively. They wait for active requests, close the gate to later requests while waiting, apply the change, and then allow those later requests to observe the new state. Integration tests cover failed validation, disconnect waiting, replacement waiting, and the writer gate; renderer coverage proves no validation bypass is offered.

## Priority 2: automated confidence

### Add missing security and boundary coverage

Complete. Marker-secret tests cover logs, OTLP spans, analytics persistence, API errors, renderer errors, and Electron crash-handler log output. Electron secure-storage tests cover availability, encryption, decryption, malformed envelopes, and corrupt ciphertext. A renderer connection client test saves a connection through the real local HTTP API, verifies the selected route and serialized secret, and invalidates the connection query without contacting Fellowship Logs. Shared API mocks now fail loudly by default, and route tests opt into the service methods they expect.

### Keep high-value behavioral suites

Complete. Authorization replay, expiry, cancellation, interruption, restart, and concurrency coverage remains intact, along with access-token rotation and concurrent-refresh coverage; loopback host, path, method, lifecycle, and response-header coverage; and queue wait, hold, binding, resume, and cost-accounting coverage. The authorization integration suite is split into lifecycle, completion and recovery, concurrency, and security files with shared setup and all behavioral assertions preserved.

The application does not currently export a diagnostics bundle. Opening the logs folder is not an export surface, so no diagnostic-export test is required unless that feature is added.

## Priority 3: documentation reconciliation

Complete. The plan now refers to the consolidated initial main, state, and analytics schemas instead of feature-numbered migrations, and its relevant-code lists contain only current domain, persistence, service, contract, and renderer paths.

Connection absence is represented by no connection, persisted connection status is limited to connected, reauthorization required, and point-system opt-in required, authorization progress has its own session state, and validation, storage, provider, and stale-command failures are operation errors. Exclusive connection saves and disconnects close the reader gate and wait for in-flight request leases before applying the change.

Own-client setup consistently gives `http://127.0.0.1:47892/oauth/callback` as the registered redirect while the app listens on an ephemeral port; portless registration remains deferred. The repository-wide Effect 4.0.5 upgrade is recorded as an infrastructure prerequisite included in this feature branch.

## Feature implementation complete when

- Priority 0 and Priority 1 are complete.
- Priority 2's missing security and boundary coverage is complete and the existing automated suites pass.
- The plan documents describe the implemented domain and no longer reference deleted migrations or files.
- Keyboard, focus-return, browser-return, error, and screen-reader checks pass.
- The Fellowship Logs account-settings link and the renderer's live Electron behavior are manually verified.
- No current workflow depends on an unmodeled database-pool exhaustion state. The database pool remains visible, but a database waiting reason is deferred until the product can spend database points.

## Production release gates

- Live user-pool exhaustion and reset recovery match the implemented waiting behavior.
- Live application-pool exhaustion, including the one-point shared hold, matches the implemented waiting behavior.
- The Windows release matrix in [07-testing-security-and-release.md](07-testing-security-and-release.md) passes on a clean supported environment.
- The integrated security review is complete and findings are resolved or explicitly accepted.
- The production OAuth client name, public-client configuration, consent display, and fixed loopback registration are verified.
- The maintainer account is opted into the new point system.
- A strict user-only import completes without spending the maintainer's application points.
- Installer signing and supported-platform copy are verified.

## Conservative assumptions, not release blockers

- Treat every signed-in user as needing the point-system opt-in until a second-account test proves otherwise.
- Keep the fixed-port registration guidance; a portless registration is unnecessary while the proven registration accepts dynamic callback ports.
- Exclude client-credentials observations from exact costs and ranges when `currentRequest` is absent.
- Rely on the app's ten-minute transaction expiry and one-time exchange even though provider stale-code expiry is not measured.
- Describe Disconnect as local-only unless the provider introduces a verified revocation endpoint.
- Display the database pool without implementing a wait for it until a production workflow can spend database points and the provider exposes a classifiable exhaustion signal.

## Deferred work

- Hosted HTTPS callback infrastructure until a loopback revisit trigger occurs.
- macOS and Linux support plans and validation.
- Database-pool waiting behavior until a product workflow requires it.
- Portless loopback registration testing.
- Second-account opt-in ownership testing when an appropriate account is available.
- Diagnostic-export redaction testing until a diagnostic-export feature exists.

# API point policy

## Implementation status

Slice 4.1, gateway credentials and request policy, is complete in the API:

- The gateway reads credentials only from the active connection. The legacy Settings and environment credentials no longer drive requests. With no connection, a request fails as `NotConnected`, so Disconnect stops all requests.
- `getFellowshipLogsGatewayRequestPolicy` maps each profile to one endpoint and one spending policy. The HTTP query reads the access once per request and takes the endpoint, bearer token, and directive from that single read.
- `applyQuerySpending` in the query module places `@onlySpendUserPoints` after the operation's name and variable definitions. In strict mode it refuses a shorthand query, or a query that already has a directive, with `DirectiveNotApplicable`, before anything is sent.
- `makeConnectionGatewayAccessSource` uses the client secret for "Use my own API client" and `FellowshipLogsAccessToken` for the signed-in profiles, so expiring tokens are refreshed first. An HTTP 401 on a signed-in request calls `reportRejected` and retries once with the replacement token. A second 401, or a session that cannot recover, fails as `ReauthorizationRequired`.
- `FellowshipLogsGatewayAccessError` covers `NotConnected`, `ReauthorizationRequired`, and `LocalProtectionAcknowledgementRequired`. A provider outage during refresh, and a connection read failure, remain the retryable `FellowshipLogsGatewayRequestError`.
- `classifyFellowshipLogsPointPolicyErrors` keeps both provider message matches in one place and maps them to `FellowshipLogsGatewayPointPolicyError` with `PointSystemOptInRequired` or `NonUserPointsRequired`. The classification runs after rate-limit tracking and before any data is read, so partial data is never used. Unrecognized GraphQL errors still fail as `ErrorsReturned`. Neither error is retried by the background job runner.
- The API services layer builds one connection and one access-token instance and shares them with the gateway, the authorization service, and the background job queue. It now includes the queue itself.
- CLI capture and probe commands use `makeClientCredentialsGatewayAccessSource`.

Slice 4.2, the point-system opt-in check and connection status, is complete in the API:

- The consolidated initial main schema includes `point_system_opt_in_required_at` on the connection. SQLite allows it only for "Connect with Fellowship Logs". The connection summary reports `POINT_SYSTEM_OPT_IN_REQUIRED` when it is set, after `REAUTHORIZATION_REQUIRED`, and signed-in credentials carry the flag and the connected-user ID.
- `FellowshipLogsConnection.setPointSystemOptInRequired` changes the flag only while the active connection is still "Connect with Fellowship Logs" for the same connected user, and reports `SESSION_CHANGED` otherwise. Saving a new authorized session clears the flag, so the check that follows decides it again.
- `FellowshipLogsPointSystemOptIn.check` sends `query CheckPointSystemOptIn @onlySpendUserPoints { rateLimitData { currentRequest } }` through the gateway HTTP query, so the endpoint, token refresh, and 401 handling are shared. It returns `OPTED_IN` and clears the flag on success, `OPT_IN_REQUIRED` and sets it on the refusal, and `NOT_REQUIRED` without a request for the other profiles. It is also the recheck after the user reports opting in.
- Authorization completion runs the check after saving the session. `Connected` carries `pointSystemOptIn`: the check result, or `UNCHECKED` when the check failed. A failed check is logged by error tag only, and the connection stays connected; the next strict request then decides. The UI can therefore distinguish a confirmed opt-in from one that could not be verified.
- While the flag is set, the gateway's access source refuses "Connect with Fellowship Logs" requests with `PointSystemOptInRequired` before reading a token or sending anything. The check uses an access source that skips this refusal. Any strict request the provider refuses for the opt-in sets the flag, so a missing or reversed opt-in is caught at import time.
- Profile validation, access selection, the provider request, response classification, and the conditional connection update hold one request lease. A connection change during the request waits until the result has been applied, so the outcome cannot update another connection.
- The CLI `authorize-fellowship-logs` command runs the real check, so a live authorization reports the `pointSystemOptIn` result. A live run on October 24, 2026 against the opted-in development account returned `OPTED_IN` with connection status `CONNECTED`. The `OPT_IN_REQUIRED` path is verified only by fixture tests until an account that has not opted in is available.

Slice 4.3, strict-mode eligibility refusal, is complete in the API:

- Gateway queries are structured values carrying their GraphQL document and an explicit `USER_POINT_ELIGIBLE` or `UNCLASSIFIED` capability. `makeQuery` requires the classification.
- In strict mode, every unclassified query is refused before sending an HTTP request. Default-spending profiles remain unaffected, and a classified query whose document cannot accept the directive fails separately as `DirectiveNotApplicable`.
- Eligible capability construction lives next to each reviewed production query definition. A new or changed strict query needs point-label evidence before it receives the capability.
- The partial `findNonUserEligibleFields` parser and its parser-specific tests are removed. Tests prove each strict production gateway query is classified, unclassified strict queries fail closed, and every profile selects its intended endpoint and spending policy.

Slice 4.4, the three-pool quota model, is complete in the API:

- `RATE_LIMIT_DATA_SELECTION` now also selects `databaseLimitPerHour`, `databasePointsSpentThisHour`, `userHasRemainingPoints`, and `userPointsResetIn`. The shared rate-limit schema decodes them as optional, so recorded fixtures and older responses still decode.
- `getFellowshipLogsPointPools` in the shared package derives the application, database, and user pools, each with its own remaining points, reset time, and reset source. The application pool uses `limitPerHour`, `pointsSpentThisHour`, and `pointsResetIn`. The database pool uses its own limit and spend but `pointsResetIn`, because the provider reports no separate database reset. The user pool reports only whether points remain and `userPointsResetIn`, because the provider exposes no user limit or spent count. A pool the provider omits is reported as unknown.
- `FELLOWSHIP_LOGS_BETA_POINT_POLICY` in the shared package holds the beta table with its version, effective date (2026-10-20), and source URL. It is guidance only: runtime provider values take precedence.
- For "Connect with Fellowship Logs", the preflight replaces the application-cost estimate with two checks. It holds a request back as `UserPointsExhausted` while the provider last reported no user points and the user reset has not passed, using a five-minute fallback when no reset is reported. It holds a request back as `ApplicationHoldUnavailable` when less than one application point remains for the hold. Both are `FellowshipLogsGatewayRateLimitExceededError` reasons, so background jobs defer until the reset rather than fail. The other profiles keep the existing application-pool preflight, so "Use my own client and sign in" can still fall back to application points when user points run out.
- The gateway reads the spending policy from the active connection for each tracked request.
- Step 5 exposes all three pools through the point-pools contract, and Step 6 displays them in the Points card. The older rate-limit response remains for the forced provider refresh.

Open questions for 4.4: the provider error text for an exhausted user or application pool is still unknown, so those refusals are not yet classified beyond the existing rate-limit message match. The client endpoint accepts the new rate-limit fields (verified live on October 24, 2026, see [01-provider-and-infrastructure.md](01-provider-and-infrastructure.md)). Whether `pointsSpentThisHour` on the user endpoint counts only application points is also unverified.

Slice 4.5, cost accounting, is complete in the API:

- `RATE_LIMIT_DATA_SELECTION` also selects `currentRequest`. `getFellowshipLogsRequestCost` reads its application, user, and total split, keeps fractional points, and derives user points as total minus application when the provider omits them. This measures user points exactly, which the earlier `pointsSpentThisHour` delta could not, because that delta only moves with application points.
- The gateway accumulates a workflow cost per import: API requests, measured application, user, and total points, cache hits, and the delta-based estimate for any request without a split. A fully cached workflow therefore costs zero points. `approximatePointsSpent` on finished jobs is now the measured total plus the estimate for unmeasured requests.
- Each metadata lookup saves a short-lived analytics-database workflow record keyed by an opaque UUIDv4 and bound to the connection generation, report, fight, exact measured cost, and expiry. The workflow ID travels through the metadata response into the persistent import-job payload.
- A workflow is claimed atomically for a newly queued job and may be reclaimed idempotently only by that job. An idempotent queue request that returns an existing job does not claim another workflow. Missing, expired, already-claimed, or mismatched workflows do not block an import; the observation excludes lookup cost and records only a non-sensitive reason tag. Completed attempts delete their claimed workflow, and routine claims prune expired and stale claimed records.
- `FellowshipLogsImportCost.measure` wraps each import attempt in the background job runner. It saves one observation per attempt to the local analytics database's consolidated initial `fellowship_logs_import_cost` table: job, report and fight, connection profile, point-policy version, outcome (`SUCCEEDED`, `FAILED`, `DEFERRED`, or `CANCELLED`), whether it resumed an earlier attempt of the same job, whether it includes the lookup, request and cache-hit counts, the point split, and start and completion times. A run that was already imported records nothing. The profile is stored only if it was the same at the start and end of the attempt.
- `getFellowshipLogsImportCostEstimate` in the shared package returns the exact cost of the latest completed, fully measured import for the current profile and policy version, and a personal range once ten comparable samples exist. A comparable sample succeeded, was not resumed, was first-time uncached, was fully measured, and matches the profile, policy version, and lookup inclusion. The range runs from the 10th to the 90th percentile sample, so single outliers cannot stretch it. Failed, cancelled, deferred, resumed, cached, unmeasured, and older-policy observations stay in the table but never affect the range.
- `FellowshipLogsImportCost.getEstimate` serves the estimate for the active connection. Observations never leave the installation.

`currentRequest` was observed on the user endpoint. Its presence on the client endpoint is not yet verified live. This is a conservative measurement limitation rather than a release blocker: client-credentials imports fall back to the delta estimate and are excluded from exact costs and ranges when the split is absent.

Step 5 carries the recheck, connection status, pools, and cost estimate over HTTP (slice 5.1) and turns an import refused for the opt-in into a waiting job that resumes after a passed recheck (slice 5.2). Showing them is step 6.

## Query execution

Select the GraphQL endpoint and directive from the active connection profile through one policy module:

| Profile | Endpoint | Directive | Fallback |
| --- | --- | --- | --- |
| Maintainer client plus user | `/api/v2/user` | `@onlySpendUserPoints` | None |
| User client credentials | `/api/v2/client` | None | Not applicable |
| User client plus user | `/api/v2/user` | None | User's application pool |

The query builder owns directive placement. Callers request an operation; they do not append directives or choose endpoints independently.

In strict user-only mode, refuse an operation before sending it unless its query definition carries the audited user-point-eligible capability. A provider rejection remains a typed point-policy error because schema labels and provider behavior can change.

## Point-system opt-in

Fellowship Logs refuses `@onlySpendUserPoints` unless an account has opted into its new point system. The opt-in is a one-way button under Web API in Fellowship Logs account settings, and opting out requires contacting support. Because it is unproven whether the signed-in user's account or only the client owner's account needs the opt-in, plan as if every user of "Connect with Fellowship Logs" must opt in on their own account.

- A refused query returns HTTP 200 with no data and the GraphQL error "cannot require only user points be spent without authenticating a user and opting into the new point system". Classify that message as `PointSystemOptInRequired`, distinct from quota exhaustion and from a field-level non-user-point error. Keep the message match in one place, with a fixture test. If the provider changes the text, the error falls back to a generic point-policy error rather than a retry.
- After authorization completes for "Connect with Fellowship Logs", run one opt-in check: `query @onlySpendUserPoints { rateLimitData { currentRequest } }`. It costs the one-point minimum, charged to the user. Store the outcome as connection status: connected, or point-system opt-in required. The same classification applies to any later strict request, so an opt-in that is never made, or is somehow reversed, is caught at import time.
- While the opt-in is missing, the recommended profile sends no import requests. Never drop the directive to work around it, because that would spend the maintainer's application points.
- After the user reports opting in, recheck with the same query. A successful check moves the connection to connected and resumes waiting jobs.
- "Use my own client and sign in" never sends the directive and does not need the opt-in, because default user-first spending already charges user points without it. "Use my own API client" uses client credentials and is unaffected.
- The maintainer account that owns the production client must be opted in before release, whichever way the per-user question resolves.

## Quota model

Model user, application, and database pools independently. Preserve the provider's reset time and source rather than projecting all responses into the existing single-pool shape.

The user-facing beta policy has one versioned source of truth with an effective date and source URL:

| Subscription | Application | Database | User |
| --- | ---: | ---: | ---: |
| Unsubscribed | 1,000 | 250 | 100 |
| Silver | 1,000 | 350 | 250 |
| Gold | 3,000 | 1,050 | 400 |
| Platinum | 9,000 | 3,200 | 800 |

These values are beta policy, not permanent product constants. Runtime provider values take precedence when available.

Strict user-only requests still require at least one application point for the provider's temporary hold. Distinguish user exhaustion from shared application-capacity unavailability.

## Cost accounting

Measure the whole user-visible import attempt: lookup, metadata, pagination, and events. Attribute cache hits separately and report a fully cached workflow as zero API points.

Store enough local metadata to compare observations by:

- connection profile;
- point-policy version;
- successful completion;
- first-time uncached status;
- total points spent;
- completion time.

Show the exact cost after the first completed import. Calculate a bounded personal range only after ten comparable samples. Failed, cancelled, partial, resumed across policies, cached, and older-policy attempts remain inspectable but do not influence the range. Hide the range when observations cannot be compared reliably.

Point observations never leave the installation.

## Relevant code

- `apps/api/src/services/fellowship-logs-gateway/query/make-query.ts`
- `apps/api/src/services/fellowship-logs-gateway/query`
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts`
- `apps/api/src/services/fellowship-logs-analytics`
- `packages/shared/src/fellowship-logs/fellowship-logs-rate-limit-schema.ts`

## Complete when

- Tests prove each profile selects one endpoint and one spending policy.
- Strict mode cannot issue application-only operations or silently fall back.
- A strict request refused for a missing opt-in maps to `PointSystemOptInRequired`, never to a retry, quota wait, or directive-free fallback.
- In strict mode, any GraphQL error fails the request, and partial data from a field-level non-user-point error is never used.
- All three provider pools decode and retain independent resets.
- Whole-workflow accounting includes lookup and pagination without double counting.
- Concurrent and restart-separated workflows cannot assign a lookup to the wrong import.
- Personal estimates satisfy every inclusion rule and remain local.

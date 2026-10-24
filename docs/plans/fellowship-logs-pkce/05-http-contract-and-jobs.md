# HTTP contracts and jobs

## Implementation status

Step 5 is split into three slices:

| Slice | Scope | Status |
| --- | --- | --- |
| 5.1 Connection contract | Connection, authorization, own-client, opt-in recheck, pool, estimate, and lookup-workflow operations, with typed renderer errors and redaction tests | Complete in the API and renderer |
| 5.2 Waiting job states | Typed waiting reasons, condition-based waits with no reset time, resume on reconnect or a passed recheck, and no generic retries for authentication or quota conditions | Complete in the API |
| 5.3 Connection transitions and jobs | Wait to disconnect or replace during an in-flight request, refuse new imports while disconnected, and move a quota-blocked job to a new profile only after confirmation, recording the policy transition | Complete in the API |

Slice 5.1, the connection contract, is complete in the API:

- A new `fellowshipLogsConnection` HTTP group under `/fellowship-logs/connection` reads status (`GET`), starts (`POST /authorization`), completes or manually pastes (`POST /authorization/callback`), and cancels (`DELETE /authorization`) authorization, saves "Use my own API client" credentials (`PUT /own-client`), disconnects (`DELETE`), and rechecks the point-system opt-in (`POST /point-system-opt-in-check`). `FellowshipLogsConnectionManager` serves the group and composes the connection, authorization, opt-in, and OAuth client services.
- Status returns the display-safe connection (profile, spending policy, status, connected user name, storage protection, point-policy version, the opaque connection generation, and the client ID for own-client profiles only) and the authorization state (`IDLE`, `PENDING` with its expiry, `CONNECTED` with the opt-in result, `CANCELLED`, `DENIED`, `EXPIRED`, or `FAILED` with a failure category, including `CONNECTION_CHANGED`). The renderer reads authorization progress by polling this endpoint; there is no push channel yet.
- The connection field is `null` when no connection exists. Only `CONNECTED`, `REAUTHORIZATION_REQUIRED`, and `POINT_SYSTEM_OPT_IN_REQUIRED` belong to the persisted connection domain. Authorization progress and terminal outcomes live in the separate authorization-session state; credential validation failures, storage intervention, provider failures, and stale commands are typed operation errors.
- Starting authorization returns the authorization URL as plain text, so the renderer can offer it to copy when the browser cannot open, and the browser launch result. The callback URL and client secret are request payloads decoded with `RedactedFromValue`, so they stay redacted inside the API.
- Starting authorization for a different profile or client, or saving own-client credentials over a different connection, fails with `FellowshipLogsApiConnectionReplacementConfirmationRequiredError` naming the current profile until the user confirms it. Both commands require `expectedGeneration`, the generation of the connection the renderer showed or `null` for none, alongside `replaceConnection`. The manager rejects a generation that is no longer current, then passes it to the eventual connection write, which checks it again atomically. A stale generation fails with `FellowshipLogsApiConnectionChangedError` (409) from start, completion, or save-own-client, and the newer connection stays.
- Saving own-client credentials first runs a `client_credentials` token request through the new `FellowshipLogsOAuthClient.checkClientCredentials`. A rejection is `FellowshipLogsApiInvalidCredentialsError`; an outage or unexpected response is `FellowshipLogsApiAuthorizationFailedError`. Nothing is saved unless the check passes.
- The `fellowshipLogs` group adds `GET /point-pools`, the last known application, database, and user pools with their resets, and `GET /import-cost-estimate`, the latest exact cost and personal range for imports that include the lookup. Refreshing the pools still goes through the forced rate-limit endpoint.
- Dungeon-run metadata includes an opaque lookup-workflow ID. The renderer carries it into the persistent import-job payload, where a newly inserted job claims the matching analytics record. Duplicate queue requests do not consume another workflow, and invalid or unavailable correlation fails open without exposing report or fight identifiers in diagnostics.
- New contract errors cover an absent connection (`NOT_CONNECTED`), a persisted reauthorization requirement (`REAUTHORIZATION_REQUIRED`), local-protection acknowledgement, point-system opt-in required, operation unavailable under the active policy, invalid credentials, invalid callback, authorization not pending (`EXPIRED` or `NO_PENDING_AUTHORIZATION`), authorization failed with a provider category, authorization not configured, replacement confirmation, and connection changed. `FellowshipLogsApiRateLimitExceededError` now carries `USER_POINTS_EXHAUSTED`, `SHARED_APPLICATION_CAPACITY_UNAVAILABLE`, or `APPLICATION_POINTS_EXHAUSTED`.
- One mapper turns gateway access, point-policy, and rate-limit errors into those contract errors for the metadata lookup, the forced rate-limit read, and the opt-in recheck. Previously access and policy errors there were generic 500s.
- Contract errors carry only categories and display-safe fields. Internal failures return an empty 500 and are logged by tag and message only.
- Route tests cover every mapping. Generation tests run the real manager and services behind the HTTP server: the generation changes only on replacement, and stale save-own-client and start-authorization requests are rejected without replacing the newer connection. Redaction tests run the real manager, connection, and authorization services behind the HTTP server and prove that the client secret, authorization code, access token, and refresh token never appear in any success or error body, including a mismatched callback.

Open for 5.1:

- The contract intentionally has no database-exhaustion reason. No production workflow spends database points; add one only when a workflow does and the provider exposes a classifiable signal.
- A manually pasted callback that an own client's token exchange rejects returns `PROVIDER_REJECTED`; the authorization status reports the more specific `OWN_CLIENT_REJECTED`. The UI should use the status for recovery guidance.
- The renderer consumes the group through the Step 6 connection and points UI.

Slice 5.2, waiting job states, is complete in the API:

- The consolidated initial state schema includes `waiting_reason` on `background_job`. A waiting job always has a reason, a reset wait always has a reset time, and a condition wait never has one; SQLite checks enforce all three.
- `getFellowshipLogsGatewayWait` is the one classification from gateway errors to waits:

  | Gateway error | Waiting reason | Reset time |
  | --- | --- | --- |
  | Access `NotConnected` | `CONNECTION_REQUIRED` | None |
  | Access `ReauthorizationRequired` | `REAUTHORIZATION_REQUIRED` | None |
  | Access `LocalProtectionAcknowledgementRequired` | `LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED` | None |
  | Point policy `PointSystemOptInRequired` | `POINT_SYSTEM_OPT_IN_REQUIRED` | None |
  | Rate limit `UserPointsExhausted` | `USER_QUOTA_RESET` | User reset |
  | Rate limit `ApplicationHoldUnavailable` | `SHARED_APPLICATION_CAPACITY_UNAVAILABLE` | Application reset |
  | Rate limit `PreflightExhausted` or `RejectedByApi` | `APPLICATION_QUOTA_RESET` | Application reset |

  Other point-policy refusals (`NotUserEligible`, `DirectiveNotApplicable`, `NonUserPointsRequired`) still fail the job, because waiting cannot fix them.
- The background job runner defers on any classified wait. Waits hand back the attempt, and only `FellowshipLogsGatewayRequestError` and `FellowshipLogsGatewayReportChangedError` use the generic retry schedule. The import keeps its stored pages, so a resumed import continues where it stopped.
- A condition wait is never claimed by time. On the import queue, condition and reset waits block later imports, and on a condition wait the worker sleeps until woken instead of setting a timer. A hold, described in slice 5.3, never blocks the queue.
- The consolidated initial state schema includes `waiting_kind`. `getBackgroundJobWaitingKind` derives it from the reason: `RESET` for the quota reasons, `HOLD` for `PROFILE_CHANGE_CONFIRMATION_REQUIRED`, and `CONDITION` for the rest. SQLite requires a kind exactly when a job waits, a reason exactly when it has a kind, and a reset time exactly for `RESET`. The queue reads the kind, not the reason, so it knows nothing about Fellowship Logs.
- `FellowshipLogsConnection.changes` emits after every save, disconnect, reauthorization requirement, and opt-in change. `FellowshipLogsWaitingJobResumerLayer` follows it, starting at startup, and requeues every condition wait whose reason differs from the current connection condition: no connection, reauthorization required, opt-in required, or none. A requeued job that still cannot run waits again with the right reason, without sending a request. A passed opt-in recheck therefore resumes opt-in waits, and a completed sign-in resumes connection and reauthorization waits.
- Cost observations record condition waits as `DEFERRED`, like quota waits, so they never count as failures or comparable samples.
- Job API items carry `waitingReason`, so the renderer can offer the matching action: connect, sign in again, acknowledge local protection, opt in and check again, or wait for the reset. Cancel already works for waiting jobs.

Database-pool waiting is deferred. The pool remains visible, but no current workflow can spend it.

Slice 5.3, connection transitions and jobs, is complete in the API:

- `FellowshipLogsConnection` owns a request lease. Gateway queries and their 401 retry hold a shared lease from the access read to the response. Disconnecting and saving a connection take the lease exclusively, so they wait for in-flight requests to finish, and requests that start meanwhile wait for the change. A request therefore reads one identity and sends with it. A writer closes the gate to new readers first, so a long import cannot starve a disconnect. Token refresh, reauthorization, and opt-in updates do not take the exclusive lease because they run inside a request and keep the same identity. The opt-in check holds that lease across its profile gate, provider request, classification, and conditional update.
- `POST /fellowship-logs/import-jobs` responds `FellowshipLogsApiConnectionRequiredError` (`NOT_CONNECTED`) while there is no connection. A connection that needs reauthorization or the opt-in still queues, and the job waits on that condition. Existing jobs and history stay visible.
- The consolidated initial state schema includes the `PROFILE_CHANGE_CONFIRMATION_REQUIRED` hold and generic `binding_key`. An import job stores the connection identity it was queued under as its binding key: profile, client ID, and connected user, from `getFellowshipLogsConnectionIdentity`.
- The background job runner runs each import with its binding key as `ExpectedFellowshipLogsConnectionIdentity`. The gateway access source compares it with the active connection while holding the request lease, before reading a token or sending anything. A mismatch fails as access reason `ConnectionChanged`, which the job turns into a `PROFILE_CHANGE_CONFIRMATION_REQUIRED` wait. The check and the request share one lease, so no connection change can land between them. This covers a quota wait whose reset passes at the moment of a change, and an import that is running when the connection changes. Requests outside a job, such as lookups and the opt-in check, carry no expected identity.
- The waiting-job resumer runs at startup and after each connection change. It moves every quota wait (`APPLICATION_QUOTA_RESET`, `USER_QUOTA_RESET`, `SHARED_APPLICATION_CAPACITY_UNAVAILABLE`) from another identity to `PROFILE_CHANGE_CONFIRMATION_REQUIRED` at once, so the UI does not show a reset countdown for a job that will need confirmation anyway. It releases held jobs whose identity matches the active connection, so returning to the original connection resumes them without confirmation. This is a display update; the in-lease check is what enforces the rule.
- A held job does not block the import queue. Later imports keep running under the active connection while it waits for confirmation, and the renderer says queued jobs are behind a paused one only for condition and reset waits.
- `POST /fellowship-logs/import-jobs/:jobId/resume-with-current-connection` is the confirmation. It requires a connection, rebinds a held job to the active identity, requeues it, and returns the job; otherwise it responds 404, or 409 when disconnected. The renderer asks for confirmation before calling it.
- The consolidated initial analytics schema includes `follows_profile_change` on import cost observations. An attempt is marked when an earlier attempt of the same job ran under a different or unknown profile. Such attempts are already resumed, so they never enter the range, and they no longer count as the exact latest cost either.

The local development reset recreates the consolidated schema, so there are no pre-binding jobs to migrate.

## Connection contract

The API exposes first-class operations for:

- reading display-safe connection status;
- beginning authorization;
- completing, denying, or cancelling authorization;
- manually submitting a callback payload;
- validating and saving BYO client credentials;
- switching profile after confirmation;
- reconnecting;
- rechecking the point-system opt-in;
- disconnecting;
- reading active quota pools and policy metadata.

Do not infer connection state from settings booleans or failed report requests.

Typed operation errors cover invalid credentials, an absent connection, authorization expired or denied, invalid callbacks, secure-storage acknowledgement, provider failures, point-system opt-in, exhausted point pools, stale connection confirmation, and operations unavailable under the active policy. They do not expand the persisted connection-status domain.

Renderer-facing errors expose actionable categories and display-safe context. Sensitive upstream bodies and causes stay server-side and redacted.

## Background-job behavior

Add recoverable waiting reasons for:

- connection required;
- reauthorization required;
- point-system opt-in required;
- user quota reset;
- application quota reset;
- shared application capacity unavailable.

Authentication and quota conditions do not consume generic network retries. A waiting job retains progress and offers the relevant action: reconnect, opt in and recheck, change profile, wait, or cancel.

Make profile switching and disconnect wait for in-flight leased requests. Validate a replacement's expected connection generation inside the exclusive write. A quota-blocked queued job may move to a new profile only after explicit confirmation. The resumed job records the policy transition and is excluded from comparable cost estimates.

New imports cannot enter the queue while disconnected. Existing queue and history remain visible.

## Relevant code

- `packages/api-contract/src/http/groups/fellowship-logs/fellowship-logs-api.ts`
- `packages/api-contract/src/errors/fellowship-logs-api-error.ts`
- `apps/api/src/api/http/groups/fellowship-logs/fellowship-logs-api-layer.ts`
- `apps/api/src/services/background-job-runner/background-job-runner-service.ts`
- `apps/api/src/services/fellowship-logs/fellowship-logs-service.ts`
- `packages/shared/src/background-job`

## Complete when

- Every connection transition is represented by a typed request and response.
- Every actionable authentication or quota condition maps to one recoverable job state.
- Generic retries remain limited to genuinely transient failures.
- In-flight requests cannot cross connection identities.
- A stale replacement confirmation cannot overwrite a newer connection, including after OAuth completion.
- Contract tests prove sensitive values cannot appear in serialized success or error payloads.

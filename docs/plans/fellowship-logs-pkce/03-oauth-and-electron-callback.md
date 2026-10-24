# OAuth and Electron callback

## Implementation status

Slice 3.1 is complete. The storage work required by this step is complete: the database can retain one protected verifier transaction, replacing it invalidates the previous transaction, protected values select OS-backed or acknowledged local-key storage, and a completed session can be persisted atomically while clearing the pending transaction.

The `FellowshipLogsAuthorization` service starts, reads, and cancels the pending PKCE transaction:

- each start generates a 32-byte base64url verifier and state with Web Crypto, derives the S256 challenge without persisting it, protects the verifier, and replaces the pending transaction with a ten-minute expiry;
- the caller selects the profile explicitly; `FELLOWSHIP_RUN_TRACKER_USER` uses the configured `FELLOWSHIP_LOGS_OAUTH_CLIENT_ID`, and `OWN_CLIENT_USER` requires a supplied client ID;
- the authorization URL is built from the fixed `FELLOWSHIP_LOGS_AUTHORIZATION_URL`, which is not configurable, and the redirect URI must be an `http://127.0.0.1` loopback URI with no query, fragment, or credentials;
- missing client ID or redirect configuration fails with a classified not-configured error, and local-key protection requires acknowledgement;
- the authorization URL is returned only as a redacted value;
- the service deletes expired transactions when it starts, and cancellation deletes the pending transaction outright;
- the API services layer receives the runtime's protected-value storage once and shares it between the connection and authorization services.

Slice 3.2 is complete. `FellowshipLogsAuthorization.complete` accepts a full callback URL from the loopback listener or a manual paste:

- `parseAuthorizationCallback` requires the transaction's exact redirect scheme, host, port, and path, with no credentials or fragment and no duplicate parameters. It accepts exactly `code` and `state` for approval, or `error` and `state` plus optional `error_description` and `hint` for denial.
- Inside one database transaction, the service reads the pending transaction, validates the callback and `state`, and deletes the transaction before any exchange. Malformed and mismatched callbacks leave the transaction in place. An expired transaction is deleted and reported as expired. A second callback finds no pending transaction, so a code is exchanged at most once.
- A denial returns `Cancelled`. An approval unprotects the verifier, exchanges the code through `FellowshipLogsOAuthClient`, reads `currentUser`, and saves the session through `FellowshipLogsConnection` with the verifier's protection level.
- `start` takes the `expectedGeneration` the user confirmed and stores it on the pending transaction. Completion passes the stored generation to `saveAuthorizedSession`, which waits for in-flight request leases and validates the generation inside the exclusive connection write. If it changed, completion fails with `FellowshipLogsConnectionChangedError`, preserves the newer connection, discards the exchanged tokens, and publishes `Failed` with `ConnectionChanged`; the user must start again. Installing a connection or disconnecting deletes a pending transaction, so the check matters after the callback consumes the transaction, while the code is exchanged and the user is read. Tests change the connection during the code exchange, including disconnect, an ABA re-authorization of the same account, an observed absence, and completion after a restart.
- `FellowshipLogsOAuthClient` sends the documented PKCE token request without a client secret, converts the numeric user ID to the stored string identity, and classifies failures as `Rejected`, `Unavailable`, or `UnexpectedResponse`. Its errors keep only the operation, HTTP status, and OAuth error code, never request bodies, response bodies, or tokens.
- Callback failures use `FellowshipLogsAuthorizationCallbackError` with the reasons `InvalidCallback`, `NoPendingAuthorization`, `StateMismatch`, and `Expired`.
- The API services layer builds one connection layer and provides it to both the connection and authorization services.
- Tests cover the parser, the provider client against a stub HTTP client, and the completion flow: approval, denial, rejected callbacks, missing and expired transactions, replay, provider rejection, local-key protection, and span redaction.

Slice 3.3 is complete in the API and Electron main process:

- `listenForAuthorizationCallback` binds a `node:http` server to `127.0.0.1` on an OS-assigned port, derives the redirect URI from that port, and accepts only `GET` on `/oauth/callback` with a matching `Host` header. It answers with a static page with `no-store`, `no-referrer`, `nosniff`, and `default-src 'none'`, and closes when its scope closes. The `FELLOWSHIP_LOGS_OAUTH_REDIRECT_URI` setting is gone.
- `start` opens the listener in a session scope that is a child of the service scope, stores the transaction with the listener's exact redirect URI, publishes `Pending`, forks the callback consumer and the expiry timer into the session scope, and opens the system browser. A browser launch failure does not fail `start`; it is returned as `browserLaunch` with the redacted authorization URL for a manual fallback.
- The callback consumer keeps listening after `InvalidCallback` and `StateMismatch`, so a stray or forged local request cannot end a real authorization. Any other outcome ends the session.
- Completion, denial, provider or storage failure, a missing transaction, cancellation, replacement by a new `start`, expiry, and service shutdown each close the session scope, which closes the listener.
- `complete` remains the manual-paste path and ends the active session the same way.
- `getStatus` and `statusChanges` expose `Idle`, `Pending`, `Connected`, `Denied`, `Cancelled`, `Expired`, and `Failed` with a failure category. The statuses carry no codes, tokens, URLs, or provider messages.
- A rejected token exchange for `OWN_CLIENT_USER` fails as `OwnClientRejected` rather than `ProviderRejected`, because a non-public own client is the observed cause. `FELLOWSHIP_LOGS_OWN_CLIENT_REQUIREMENTS` in the shared package holds the setup guidance for that failure, for an own-client `Expired` status, and for the setup form.
- `SystemBrowser` is a runtime-supplied service. Electron opens only `https:` URLs through `shell.openExternal` and reports failures without the URL. Runtimes without a browser use an unavailable implementation.
- `makeApiLayer` and `makeApiServicesLayer` take the runtime's protected-storage and system-browser layers together.

Live-verified October 24, 2026 with `pnpm fellowship-logs:authorize`, which runs the real services against Fellowship Logs with a throwaway database and local-key protection. The development client authorized through an ephemeral loopback port and reached `Connected`. The session stored connected user ID `13100` as a string, an access token expiring in 360 days, and a refresh token. The stored access token was read back through protected storage and accepted by `/api/v2/user` for the same user.

Step 5 carries `start`, `cancel`, and `complete` through the HTTP contract, and Step 6 consumes them in the renderer by polling display-safe authorization status. The Windows firewall check still needs a manual run of the packaged app.

Slice 3.5 is complete in the API, with live refresh and revocation verification through the app's services recorded below:

- `FellowshipLogsOAuthClient.refreshTokens` sends `grant_type=refresh_token`, `client_id`, and `refresh_token` with no secret and shares the token-response handling and error classification with the code exchange.
- `FellowshipLogsAccessToken.get` returns the signed-in session's access token, client ID, and profile. When the token expires within five minutes, it refreshes first, stores the rotated access and refresh tokens in one transaction, and only then returns the new access token. A semaphore serializes `get` and `reportRejected`, so concurrent requests refresh once and never present a refresh token that an in-flight refresh has already rotated.
- An `invalid_grant` refresh rejection, an expiring session without a refresh token, and `reportRejected` for the current access token after an HTTP 401 clear the stored tokens and fail with `FellowshipLogsReauthorizationRequiredError`. Later calls fail with reason `PreviouslyRequired` without contacting the provider. A provider outage during refresh fails with the classified provider error and leaves the session intact.
- `reportRejected` for an access token that a refresh already replaced leaves the session alone, so the caller can retry with `get`.
- A connection that has lost its tokens keeps its profile, client ID, and connected-user identity, and its summary reports `REAUTHORIZATION_REQUIRED`. A completed authorization replaces it and returns it to `CONNECTED`. The consolidated initial main schema models an authorized profile without tokens directly.
- `FellowshipLogsConnection.replaceTokens` and `requireReauthorization` change the session only if its stored access token still matches the one the caller used, and report `SESSION_CHANGED` otherwise. A refresh racing a new authorization or a disconnect therefore cannot overwrite or revive the connection.
- Refresh refuses to start when the session is OS-backed and protected storage now needs local-key acknowledgement, because rotating revokes the previous access token and the new tokens could not be stored.
- Missing and client-secret connections fail with `FellowshipLogsNoSignedInSessionError`.

`pnpm fellowship-logs:authorize --check-refresh` expires the stored access token, refreshes it through `FellowshipLogsAccessToken`, and reports these results: whether both tokens rotated, whether the stored tokens match the returned token, whether the new and previous access tokens are accepted, whether replaying the previous refresh token is rejected, and whether the current token survives that replay. `--check-revocation` waits while the user removes the app under Authorized Applications, then reports whether the issued access token and refresh token still work. If the access token gets a 401, it also reports the resulting connection status. Both checks print only outcomes, HTTP statuses, and OAuth error codes, never tokens. Both ran live on October 24, 2026. The refresh results matched the Step 1 probes. After the app was removed under Authorized Applications, the previously issued access token and refresh token both still worked; see [01-provider-and-infrastructure.md](01-provider-and-infrastructure.md).

Step 4 slice 4.1 moved the gateway from legacy credentials to the connection. Signed-in requests get their token from `FellowshipLogsAccessToken` and call `reportRejected` on an HTTP 401. Disconnect is local-only, because removing the app on Fellowship Logs does not revoke issued tokens.

Step 1 live probes confirmed the authorization and token endpoints, public-client PKCE, the approval and denial callbacks, the token response, refresh rotation, and the connected-user query. See [01-provider-and-infrastructure.md](01-provider-and-infrastructure.md).

## Redirect architecture

Decided October 24, 2026: use an ephemeral-port loopback redirect. Defer the hosted HTTPS callback bridge.

The registered own-client redirect URI is `http://127.0.0.1:47892/oauth/callback`. Fellowship Logs matches loopback redirects by host and path and ignores the port, so the app listens on a free `127.0.0.1` port for each authorization and sends that runtime URI in the authorization and token requests. The provider sends both approval and denial back to that listener. Whether a portless registration works is unproven and deferred.

This follows RFC 8252 for native apps and removes the custom protocol, installer protocol registration, cold-start and second-instance callback intake, the HTTPS bridge, and the domain and hosting setup from the current scope.

The port behavior is observed, not documented. Revisit the deferred HTTPS bridge if Fellowship Logs stops accepting dynamic loopback ports, if a supported platform cannot run a loopback listener, or if users report firewall or browser restrictions that the manual paste fallback cannot cover.

## Planned slices

### 3.1 PKCE transaction and authorization URL

- Generate a cryptographically random verifier and state.
- Derive the S256 code challenge without persisting it.
- Select the client ID and intended authorized profile explicitly.
- Protect and replace the single pending verifier transaction with a ten-minute expiry.
- Build an authorization URL from the fixed provider endpoint without logging the URL or its sensitive parameters.
- Support cancellation and expiry cleanup.
- Test replacement, expiry, state uniqueness, challenge derivation, protection acknowledgement, and URL parameters.

Complete. Slice 3.3 changes the redirect URI from a configured value to the listener's actual port.

### 3.2 Callback validation and code exchange

- Parse an exact callback input. Approval carries exactly `code` and `state`. Denial carries exactly `error`, `error_description`, `hint`, and `state`. Reject duplicate or unexpected meaning-changing parameters.
- Match state, expiry, client, redirect URI, and outstanding transaction.
- Consume each authorization code once.
- Exchange the code with the retained verifier: `client_id`, `code_verifier`, `redirect_uri`, `grant_type=authorization_code`, and `code`, with no client secret.
- Fetch `userData.currentUser { id name }` and save the completed session. `id` is `Int!`, so convert it to the stored identity type deliberately.
- Classify `access_denied` as user cancellation, and classify expiry, replay, provider, and secure-storage failures, without exposing sensitive values.

Complete.

### 3.3 Loopback callback listener and browser launch

- Start a one-shot HTTP listener on `127.0.0.1` with an OS-assigned port before creating the transaction, and store the exact redirect URI, including that port, on the transaction.
- Accept only `GET` on the registered callback path with a matching `Host` header, and answer with a minimal `no-store`, `no-referrer` page. Keep listening after a callback that does not match the pending transaction.
- Close the listener on completion, denial, failure, cancellation, transaction replacement, expiry, and app shutdown.
- Open the system browser and report launch failure.
- Add manual callback paste as the fallback path, validated by the same callback parser.
- Show a pending state with Cancel. A redirect mismatch shows raw `invalid_client` JSON in the browser and never reaches the listener, so the expiry is the only signal.
- Publish redacted success, denial, cancellation, expiry, and failure states for the renderer.
- Confirm on Windows that binding to `127.0.0.1` raises no firewall prompt.

Complete, except the manual Windows firewall check. The renderer transport for these states is step 5 work.

### 3.4 Deferred: HTTPS callback bridge

Not in the current scope. If a revisit trigger occurs, restore a static HTTPS bridge that relays the callback to the app through a custom protocol or the loopback listener, with copy/paste fallback. [01-provider-and-infrastructure.md](01-provider-and-infrastructure.md) retains the domain, DNS, hosting, and hardening research for that case.

### 3.5 Token lifecycle and recovery

- Access tokens last 360 days. Refresh with `grant_type=refresh_token`, `client_id`, and `refresh_token`.
- Each refresh rotates the refresh token and revokes the previous access token. Persist both new tokens atomically with the active protection mechanism before using either one.
- A reused stale refresh token is rejected with `invalid_grant` and does not revoke the current tokens.
- Move irrecoverable sessions, such as `invalid_grant` on refresh or HTTP 401 on a current token, to reauthorization-required state.
- Prove restart, expiry, refresh, disconnect, and replay behavior.
- Server-side revocation is not available. Deleting the app under Authorized Applications resets consent but leaves issued access and refresh tokens working (proven October 24, 2026), so describe Disconnect as local-only.

Complete in the API. Tests cover expiry, refresh and rotation, concurrent refresh, `invalid_grant`, a missing refresh token, provider outage, 401 handling, stale rejection reports, and reauthorization. Restart is covered by persistence, because every read goes through the database. The gateway integration is step 4 work.

## Authorization sequence

1. The API starts a loopback listener on a free `127.0.0.1` port.
2. The API creates a ten-minute PKCE transaction for that exact redirect URI using a cryptographically random verifier and state.
3. The app opens the provider authorization URL in the default system browser.
4. The provider shows a consent screen only if the app is not already authorized, then redirects to the listener with an approval or denial.
5. The listener hands each matching request to the service, which ignores callbacks for another state and ends the session on the first definitive outcome. Manual paste is the fallback input.
6. The API verifies the exact callback shape, state, expiry, intended client, redirect URI, and outstanding transaction.
7. The API exchanges the one-time code with the retained verifier.
8. Completion clears the pending transaction before publishing connected state.

The callback payload is untrusted input. Accept the exact host, path, and allowlisted parameters. Reject duplicates, unexpected fields that change meaning, replayed codes, mismatched state, expired transactions, and callbacks without an outstanding transaction.

## Electron integration

Add explicit capabilities for:

- opening the authorization URL in the system browser and reporting launch failure;
- submitting a manually pasted callback;
- cancelling a pending authorization;
- notifying the Fellowship Logs page of success, denial, expiry, or actionable failure.

The loopback listener runs in the API process, so the portable ZIP and an installed build behave the same and need no protocol registration.

## Logging boundary

Authorization codes, tokens, secrets, verifiers, complete callback URLs, and OAuth query parameters are forbidden in logs, spans, analytics, renderer-facing causes, and crash payloads. Record redacted categories and correlation-safe transaction status instead.

## Relevant code

- `apps/electron/src/main.ts`
- `apps/electron/src/application/run-electron-application.ts`
- `apps/electron/src/application/window-open-handler`
- `apps/electron/src/ipc`
- `apps/electron/src/preload.ts`
- `apps/api/src/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts`
- `apps/api/src/services/fellowship-logs-authorization`
- `apps/api/src/services/fellowship-logs-oauth-client`
- `apps/api/src/validation/fellowship-logs-oauth-config-schema.ts`
- `apps/cli/src/commands/probe-fellowship-logs-oauth-command.ts`

## Complete when

- Windows approval, denial, cancel, stale, replay, redirect-mismatch timeout, and manual-paste flows pass.
- An authorization code is exchanged once and only against its originating transaction.
- The loopback listener never outlives its transaction and accepts only the exact callback path.
- A secret-scanning test proves forbidden values do not reach observability surfaces.

# Fellowship Logs PKCE

## Outcome

Fellowship Run Tracker supports one active Fellowship Logs connection through three explicit profiles:

| Profile | Authentication | Point policy | Report access |
| --- | --- | --- | --- |
| Connect with Fellowship Logs | Fellowship Run Tracker client ID and PKCE | User points only | Public and user-authorized private reports |
| Use my own API client | User client ID and secret | User application points | Public reports |
| Use my own client and sign in | User public-client ID and PKCE | User points, then that client's application points | Public and user-authorized private reports |

"Use my own client and sign in" requires a client created with Fellowship Logs' Public Client option and the `127.0.0.1` loopback redirect. A client with a secret cannot complete PKCE without that secret, and the app never sends one for this profile. Such a client remains usable through "Use my own API client".

The first profile is the recommended default. It applies `@onlySpendUserPoints` to every eligible operation and refuses operations that require application points. It never falls back to the maintainer's application allocation.

Fellowship Logs refuses `@onlySpendUserPoints` until an account opts into its new point system with a one-way button under Web API in account settings. Whether the signed-in user's account or only the client owner's account needs the opt-in is unproven. The plan assumes the worst case: every user of the recommended profile must opt in, and the app detects and explains a missing opt-in. Opting out requires contacting Fellowship Logs support.

The Fellowship Logs page owns connection setup, connection status, quota state, imports, waiting jobs, and recovery. Generic Settings contains no credential controls.

## Product invariants

- One active connection and one pending authorization transaction exist at a time.
- A request never changes profile, endpoint, identity, or spending policy implicitly.
- The system browser owns login and consent. The app never collects a Fellowship Logs password.
- Disconnect removes local authorization capability without deleting cached reports, imported runs, or queued jobs.
- Quota, authentication, and point-system opt-in interruptions are waiting states, not generic request failures.
- Point-usage history remains local.
- Cost guidance uses comparable, successful, uncached imports from the current policy and connection mode.
- Secrets, tokens, verifiers, authorization codes, and callback URLs never enter logs, traces, analytics, renderer errors, or crash reports.
- Windows is the first supported PKCE platform. macOS and Linux support remain explicit follow-up work until their validation matrices pass.
- This work does not require a runtime feature flag. The feature branch and release process are the rollout boundary.

## Release gates

Production PKCE support waits for Fellowship Logs to confirm or live testing to prove:

- accepted loopback redirect formats and dynamic ports (proven October 24, 2026);
- whether a user-supplied client ID can use PKCE (proven October 24, 2026: only public clients complete the exchange; decided to require a public client);
- access-token expiry and refresh-token rotation (proven October 24, 2026), and revocation and logout behavior (proven October 24, 2026: removing the app under Authorized Applications does not invalidate issued access or refresh tokens, so Disconnect is local-only);
- the user endpoint and connected-user identity fields (proven October 24, 2026);
- that every field used by an import is `[User-Eligible Points]` (proven October 24, 2026: every import query ran under `@onlySpendUserPoints` with zero application points);
- `@onlySpendUserPoints` behavior for mixed-eligibility queries (proven October 24, 2026: the non-user field errors while the rest succeeds);
- live user-pool exhaustion and reset recovery;
- live application-pool exhaustion and the one-application-point request hold.

Unknown opt-in ownership is handled conservatively by requiring every signed-in user to follow the opt-in flow. The fixed-port registration is proven to accept dynamic callback ports, so portless registration is deferred. Missing client-endpoint `currentRequest` data excludes an observation from exact estimates. Database exhaustion is deferred until a production workflow can spend database points and the provider exposes a classifiable signal.

Record evidence and decisions in [01-provider-and-infrastructure.md](01-provider-and-infrastructure.md). A failed gate changes the design before implementation proceeds downstream.

## Execution order

Follow [08-path-forward.md](08-path-forward.md): add missing automated confidence, complete accessibility and live feature validation, then collect production-release evidence. Domain and standards cleanup is complete.

Provider evidence remains recorded in Step 1, but only unknown behavior that can invalidate current recovery logic blocks release. Testing and security work remains continuous.

## Implementation progress

| Step | Status | Next action |
| --- | --- | --- |
| 1. Provider and infrastructure | In progress | Live probes proved public-client PKCE, the token response, 360-day access tokens, rotating refresh tokens that revoke the previous access token, code-replay rejection, user identity, the denial callback, and the per-request point split. Loopback redirects accept dynamic callback ports and enforce the path, so the fixed-port registration guidance and ephemeral listener are adopted and the HTTPS bridge is deferred. A non-public own client cannot complete PKCE, so that profile requires a public client. Removing the app under Authorized Applications does not invalidate issued tokens, so Disconnect is local-only. After opting into the new point system, every import query ran under `@onlySpendUserPoints` on user points only, and a mixed query returned a field error for the non-user field. Remaining release evidence: live user- and application-pool exhaustion and reset recovery. |
| 2. Authentication domain and storage | Complete | Token refresh and the reauthorization-required state are in place. The consolidated initial main schema contains the connection and authorization tables and omits the legacy credential table. Each installed connection has a generation UUID, and a replacement is written only if the generation the user confirmed is still current. Client credential schemas and imports now follow the Fellowship Logs domain boundary, and the branch's new tagged-union branches use exhaustive Effect matching. |
| 3. OAuth and Electron callback | Complete | Slices 3.1 through 3.3 and 3.5 are complete across the API, Electron main process, HTTP contract, and renderer. A pending authorization stores the connection generation the user confirmed, and completion saves the session only if it is still current. The Windows firewall check is manual, and the HTTPS bridge is deferred. |
| 4. API point policy | Complete | Slices 4.1 through 4.5 and their correctness refactors are implemented. The opt-in check holds one request lease, durable analytics records correlate lookup cost with imports, and explicit query capabilities enforce strict user-point eligibility without parsing GraphQL. |
| 5. HTTP contract and jobs | Complete | Slices 5.1 through 5.3 are implemented in the API and consumed by the renderer. The contract carries the connection generation and lookup-workflow ID, returns a typed connection-changed error for stale confirmation, and preserves generic wait, reset, hold, and binding behavior. |
| 6. Fellowship Logs UI | In progress | Slice 6.1 is complete in the renderer: the Connection card covers the three profiles, browser sign-in with cancel and manual fallback, own-client setup, the opt-in recheck, reconnect, change, and disconnect, with in-place confirmations, and imports are gated on a usable connection. Slice 6.2 is complete in the renderer: a Points card shows the three pools by profile with reset times, the exact latest import cost and personal range, and the beta limits; lookups are gated on the profile's pools; waiting jobs explain their reason; and a held job continues with the current connection only after confirmation. Slice 6.3's cleanup is complete: Settings has no credential controls, and the legacy credentials are gone. Next: the keyboard, focus-return, and screen-reader checks. |
| 7. Testing, security, and release | Continuous | Add evidence and tests with each slice; complete the full acceptance matrix last. |

## Path forward

[08-path-forward.md](08-path-forward.md) is the authoritative prioritized ledger for remaining correctness work, architectural refactors, automated coverage, documentation reconciliation, feature-completion checks, and production-release evidence.

Correctness and architectural refactors come before the remaining feature validation. Production-release evidence is tracked separately from implementation completion.

Completed foundations include the consolidated initial connection and authorization schema, active-connection and pending-authorization DAOs, protected-value envelopes, OS-backed Electron protection with acknowledged local-key fallback, the connection service for client-secret and completed authorized profiles, atomic replacement/disconnect cleanup, runtime-specific storage composition, and regression coverage.

## Delivery boundaries

- Optimize the schema for a clean start. There are no external users requiring migration UX.
- The consolidated initial schemas are the local reset. Existing development data may be deleted and recreated rather than migrated through feature-only intermediate schemas.
- Use an ephemeral-port `127.0.0.1` loopback redirect. A hosted HTTPS callback bridge is deferred until a revisit trigger in [03-oauth-and-electron-callback.md](03-oauth-and-electron-callback.md) occurs.
- Keep `http://127.0.0.1:47892/oauth/callback` as the registered own-client guidance while the provider continues accepting dynamic callback ports for that registration.
- Production OAuth-client registration remains a human deployment step. Domain purchase and hosting are needed only if the bridge returns.
- Do not add packages without a separate provenance review and approval.
- Effect 4.0.5 is an acknowledged infrastructure prerequisite included in this feature branch.

## Plan completion

Feature implementation is complete when the feature-completion gate in [08-path-forward.md](08-path-forward.md) passes. Production release additionally requires that document's release gates, supported-platform claims, and strict live import evidence.

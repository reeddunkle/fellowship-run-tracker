# Authentication domain and storage

## Implementation status

The persistence and protected-storage foundations are complete:

- shared schemas define the three connection profiles, authorized profiles, point-policy version, storage-protection levels, connected-user identity, OAuth state, and redirect URI;
- protected values use a versioned envelope that distinguishes OS-backed ciphertext from acknowledged local-key ciphertext;
- the consolidated initial main schema contains singleton active-connection and pending-authorization tables with profile and protection invariants enforced by SQLite;
- DAOs save, replace, read, and delete the active connection and the single pending authorization transaction;
- integration tests cover connection replacement, disconnect deletion, and invalidation of an earlier pending authorization.
- the API package defines a protected-value boundary with explicit local-fallback acknowledgement;
- the Electron adapter prefers OS-backed encryption and transparently reads acknowledged local-key values;
- unit tests cover OS-backed round trips, protection status, fallback delegation, and refusal without acknowledgement.
- the connection service persists client-secret and completed authorized profiles, exposes separate display-safe and internal credential reads, and atomically clears pending authorization during replacement or disconnect;
- the Electron runtime supplies OS-backed protected storage while non-Electron API runtimes retain the acknowledged local-key provider.

The legacy credential path is gone. Step 4 moved requests to the connection, and steps 5 and 6 replaced the renderer contracts and Settings controls. The consolidated initial schema does not contain `fellowship_logs_credential`. Recreating local development data is the reset path: there are no external users, so a developer reconnects through the Fellowship Logs page.

## Completed slices

1. Connection schemas, consolidated initial main schema, models, DAOs, and persistence-layer registration.
2. Versioned protected-value envelopes and explicit local-fallback acknowledgement.
3. Electron OS-backed protection with local-key fallback and protection-status reporting.
4. Connection service for client-secret and completed authorized profiles.
5. Atomic active-connection replacement, pending-authorization cleanup, and disconnect.
6. Runtime composition that supplies Electron secure storage to the desktop app and local-key storage to other API runtimes.
7. Connection generation and atomic replacement confirmation.

## Downstream slices

- Step 3 owns creation and completion of pending PKCE transactions.
- Step 3 and the provider evidence own token exchange, refresh, rotation, expiry, and reauthorization behavior.
- Step 4 moved Fellowship Logs requests from the legacy settings credentials to connection-service credentials.
- Steps 5 and 6 removed the renderer-facing legacy credential path, and the consolidated initial schema omits the legacy table.

## Connection model

Represent the active connection as a discriminated domain state, not as optional client ID, secret, and token fields.

The three configured profiles are:

- maintainer client plus authorized user, with strict user-only spending;
- user client plus secret, with client-credentials spending;
- user public client plus authorized user, with user-first spending and fallback to that client's application pool. The client must be created with Fellowship Logs' Public Client option; a client with a secret cannot complete PKCE without it, and this profile never stores or sends a secret.

Persisted connection status is independent from profile type. It distinguishes connected, reauthorization required, and point-system opt-in required. Point-system opt-in required applies only to "Connect with Fellowship Logs" and keeps the session and tokens because the user only has to change a Fellowship Logs account setting.

No connection is represented by absence. Authorization pending and its terminal outcomes belong to the authorization-session state. Invalid credentials, secure-storage intervention, and provider unavailability are operation errors. Keeping these domains separate prevents transient operations from becoming durable connection states.

One pending PKCE transaction contains the client ID, redirect URI, state, verifier, creation time, intended profile, and the connection generation the user confirmed replacing. Starting another transaction invalidates it. It expires after ten minutes.

## Persistence

The consolidated initial main schema persists:

- active profile type;
- user-supplied client ID when applicable;
- protected client secret only for client-credentials mode;
- protected access token and expiry for authorized profiles;
- protected refresh token and rotation metadata only if the provider returns one;
- display-safe connected-user identity;
- point-policy version;
- a generation UUID that changes only when a connection is installed or replaced;
- no pending verifier after completion, cancellation, or expiry.

The application API never returns a secret or token. Public connection responses expose only display-safe identity, profile, status, expiry, protection level, point policy, and the opaque connection generation.

## Protected storage

Use Electron OS-backed secure storage where supported. Persist only ciphertext and the metadata required to select the protection mechanism.

When OS-backed protection is unavailable:

1. Explain that encrypted values use a key stored in local app data and are not protected by the OS credential store.
2. Require explicit acknowledgement before saving a secret or token.
3. Report the active protection level in connection management.

The Electron OS-backed adapter continues to read acknowledged local-key envelopes through its fallback provider, while new writes use the active protection mechanism. The consolidated schema needs no feature-only migration for this behavior. Because there are no external users, recreating local development data remains the reset path if an older local value cannot be read.

## Connection generation

- `generation` is a UUIDv4 stored on the active connection and generated with Effect `Crypto`. `saveOwnClient` and `saveAuthorizedSession` install a new one on every save, including a reconnect of the same profile and account. `replaceTokens`, `requireReauthorization`, and `setPointSystemOptInRequired` keep it.
- Both install operations take `expectedGeneration`, which is the generation the caller observed or `null` for none. Inside the exclusive lease and database transaction, they compare it with the stored generation before writing. A mismatch fails with `FellowshipLogsConnectionChangedError` and changes nothing.
- The pending authorization transaction stores a nullable `expected_generation`, so completion checks the generation confirmed when the sign-in started.

## Lifecycle

- Validate BYO client credentials before replacing the active connection.
- Do not save BYO credentials when validation cannot complete. Provider and network failures remain retryable setup errors; there is no Save Anyway state.
- Treat invalid credentials as a blocking validation result.
- Validate the connection generation the user confirmed inside the exclusive replacement operation. A stale credential check or OAuth flow preserves the newer connection and returns a typed connection-changed result.
- Saving or disconnecting a connection takes the connection lease exclusively. The change closes the gate to new requests, waits for every in-flight request lease to finish, applies the write, and then lets later requests observe the new connection state.
- Persist a valid OAuth session across restarts.
- Refresh only according to verified provider behavior.
- Require reauthorization when a session cannot be refreshed.
- Disconnect clears protected tokens, secrets, pending transactions, and display identity.
- Disconnect preserves cached API responses, imported runs, analytics, and queued jobs.
- Describe Disconnect as local-only. Fellowship Logs has no known revocation endpoint, and removing the app under Authorized Applications leaves issued tokens working (proven October 24, 2026).

## Relevant code

- `packages/shared/src/fellowship-logs/fellowship-logs-connection-schema.ts`
- `packages/db/src/migrations/main/0001-initial/fellowship-logs.ts`
- `packages/db/src/daos/fellowship-logs-connection`
- `packages/db/src/daos/fellowship-logs-authorization-transaction`
- `packages/db/src/validation/encryption/protected-value-schema.ts`
- `apps/api/src/services/protected-value-storage`
- `apps/api/src/services/fellowship-logs-connection`
- `apps/electron/src/services/protected-value-storage`
- `packages/shared/src/fellowship-logs`

## Complete when

- Invalid domain states are unrepresentable without optional-field combinations.
- Protected values never cross the renderer contract.
- Restart, expiry, refresh, disconnect, replacement, and fallback-protection tests pass.
- The UI can state the actual protection level without overclaiming.
- Replacement confirmation is atomic with the eventual connection write, including OAuth completion.
- Local legacy data has a documented reset path through the consolidated initial schema.

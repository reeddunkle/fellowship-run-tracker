# Provider and infrastructure

## Purpose

Turn undocumented provider behavior and deployment choices into evidence before they constrain the implementation.

## Infrastructure prerequisite

The feature branch includes the repository-wide Effect 4.0.5 upgrade. The `effect`, `@effect/platform-node`, `@effect/platform-node-shared`, and `@effect/sql-sqlite-node` catalog entries stay pinned to 4.0.5 as one prerequisite for this feature; the upgrade is part of the branch rather than follow-up release work.

## Provider investigation

Create development and production OAuth clients with distinct client IDs. The production client ID is public build configuration. No maintainer client secret ships with the app.

Test and record:

1. Exact redirect URI matching rules.
2. HTTPS callback acceptance.
3. `fellowship-run-tracker://oauth/callback` acceptance.
4. Fixed and dynamic `127.0.0.1` callback acceptance.
5. PKCE support for a user-created client that also has a client secret.
6. Authorization denial, stale code, replay, and mismatched redirect behavior.
7. Token response fields, expiry, refresh, rotation, and revocation.
8. `/api/v2/user` access to public and private reports.
9. Connected-user identity fields suitable for display.
10. User, application, and database rate-limit response shapes.
11. Field eligibility for every selection in the import queries.
12. `@onlySpendUserPoints` behavior when user points, application points, or both are exhausted.
13. Behavior when a query mixes user-eligible and application-only fields.

Prefer official Fellowship Logs documentation or provider support answers. Record live probes with secrets and tokens removed.

## Evidence status

Last reviewed October 24, 2026.

### Confirmed by the beta announcement

- Authorization Code and PKCE requests can spend user points on fields labeled `[User-Eligible Points]`.
- Report events, tables, and graphs are generally user-eligible; rankings are not.
- User points are spent before application points by default.
- `query @onlySpendUserPoints { ... }` disables application-point fallback for a query.
- A request requires at least one available application point for a temporary hold even when it ultimately spends only user points.
- Successful user-only requests release the application hold and apply the minimum one-point charge to the user.
- Database points also count as application points, and database cost can scale with processing time.
- The beta hourly pools are 1,000/250/100 for unsubscribed, 1,000/350/250 for Silver, 3,000/1,050/400 for Gold, and 9,000/3,200/800 for Platinum, ordered as application/database/user.
- The beta values and exact behavior are subject to change.

### Confirmed by the Fellowship Logs API documentation

The Fellowship Logs "Working With OAuth" and "Point Types" documentation, reviewed October 24, 2026, states:

- The authorization URI is `https://www.fellowshiplogs.com/oauth/authorize` and the token URI is `https://www.fellowshiplogs.com/oauth/token`.
- Clients are created at `https://www.fellowshiplogs.com/api/clients/` with a name, shown to users during authorization, and comma-separated redirect URIs.
- The PKCE authorization request uses `client_id`, `code_challenge`, `code_challenge_method=S256`, `state`, `redirect_uri`, and `response_type=code`. The challenge is unpadded base64url SHA-256 of the verifier.
- The PKCE token request posts `client_id`, `code_verifier`, the same `redirect_uri`, `grant_type=authorization_code`, and `code`, without a client secret.
- The verifier is 43 to 128 characters from the RFC 7636 unreserved alphabet.
- The callback returns `state` and `code` as query parameters.
- `/api/v2/user` accepts Authorization Code and PKCE tokens; `/api/v2/client` accepts client-credentials tokens and only reaches public data.
- The point-type rules match the beta announcement: user points apply only to `[User-Eligible Points]` fields, are spent first, fall back to application points unless the query uses `@onlySpendUserPoints`, and every request needs one available application point for the hold.

The slice 3.1 authorization URL already matches these parameters and the fixed authorization endpoint.

The documentation does not establish accepted redirect formats, the denial callback shape, token response fields, access-token lifetime, refresh tokens, revocation, logout, scopes, connected-user identity fields, or whether a client that has a secret can also use PKCE.

### Development OAuth client

Created October 24, 2026:

- Name: Fellowship Run Tracker (dev).
- Client ID: `01a16f02-8dc1-71dc-907f-8635b31d0ac5`.
- The client form offers a Public Client option, which is checked for this client.
- Registered redirect URI: `http://127.0.0.1:47892/oauth/callback`. The custom-scheme, dynamic-port, and HTTPS forms have not been submitted yet.

### Live PKCE probes, October 24, 2026

Three probe runs used `pnpm fellowship-logs:probe-oauth` against the development client. They sent the documented PKCE parameters with no scope parameter and no client secret. The redacted reports are in `data/fellowship-logs-oauth-probe/`:

- `report-2026-10-24T17-53-16.901Z.json`: the first run, with the fixed loopback redirect.
- `report-2026-10-24T17-59-01.923Z.json`: the fixed loopback redirect, with a token-lifecycle sequence that separates replay from refresh.
- `report-2026-10-24T17-59-33.548Z.json`: the same sequence, redirecting to `http://127.0.0.1:51234/oauth/callback`.

Proven:

- **Public-client PKCE:** the authorization and token exchange succeed with only the client ID and verifier.
- **Fixed loopback redirect:** `http://127.0.0.1:47892/oauth/callback` is accepted when registered exactly.
- **Dynamic loopback port:** with only `http://127.0.0.1:47892/oauth/callback` registered, authorization and token exchange both succeeded with `http://127.0.0.1:51234/oauth/callback`. Loopback matching ignores the port, as RFC 8252 section 7.3 recommends.
- **Loopback path enforcement:** `http://127.0.0.1:51234/oauth/other` is rejected at the authorization endpoint without redirecting. The browser shows the raw JSON `{"error":"invalid_client","error_description":"Client authentication failed"}`. The error does not name the redirect URI as the cause.
- **Approval callback:** returns exactly `code` and `state`, and `state` round-trips unchanged.
- **Consent screen:** the provider shows Authorize and Cancel buttons only when the app is not already authorized. While the app appears under the account's Authorized Applications, a new authorization request redirects immediately with a code and shows no consent screen.
- **Denial callback:** Cancel redirects to the registered URI with exactly `error`, `error_description`, `hint`, and `state`. `error` is `access_denied`, `error_description` is "The resource owner or authorization server denied the request.", and `state` round-trips unchanged. Recorded in `report-2026-10-24T18-10-59.941Z.json`.
- **User revocation:** the account page lists the app under Authorized Applications after approval, and the user can delete it there. Deleting it brought the consent screen back.
- **Token response:** HTTP 200 JSON with exactly `access_token`, `expires_in`, `refresh_token`, and `token_type`. `token_type` is `Bearer`. There is no `scope` field.
- **Access token:** a JWT with `aud`, `exp`, `iat`, `jti`, `nbf`, `scopes`, and `sub` claims. Its scopes are `view-user-profile` and `view-private-reports`, granted without requesting them.
- **Access-token lifetime:** `expires_in` is 31,104,000 seconds (360 days), matching the JWT `exp - iat`.
- **Refresh token:** opaque, 872 characters.
- **Refresh:** `grant_type=refresh_token` with only `client_id` and `refresh_token` succeeds and returns the same four fields with a new 360-day access token.
- **Refresh rotation:** every refresh returns a new refresh token. Reusing the previous one fails with HTTP 400 `invalid_grant` and the hint "Token has been revoked".
- **Refresh revokes the previous access token:** after a refresh, the earlier access token returns HTTP 401 and the new one returns 200.
- **No refresh-token family revocation:** after a rejected reuse of an earlier refresh token, the current access token still works, and the current refresh token still refreshes.
- **App refresh path:** on October 24, 2026, `pnpm fellowship-logs:authorize --check-refresh` refreshed through `FellowshipLogsAccessToken` with the development client. Both tokens rotated, and the stored tokens matched the returned token with a new 360-day expiry. The new access token was accepted. The previous access token got HTTP 401. Replaying the previous refresh token got HTTP 400 `invalid_grant`, and the current access token and stored tokens were unchanged afterwards.
- **Removing the app does not revoke issued tokens:** on October 24, 2026, `pnpm fellowship-logs:authorize --check-revocation` connected with the development client, and the user then deleted the app under Authorized Applications. Afterwards the previously issued access token was still accepted by `/api/v2/user`, and the previously issued refresh token still refreshed successfully, returning a new token pair. Removing the app only resets consent. Neither the user nor the app has a known way to invalidate an issued token before it expires.
- **Code replay:** a second exchange of the same code fails with HTTP 400 `invalid_grant` and the hint "Authorization code has been revoked". The replay does not revoke the access token issued for that code.
- **Error shape:** token errors are JSON with exactly `error`, `error_description`, and `hint`.
- **User endpoint:** `/api/v2/user` accepts the token. `User` has `id: Int!`, `name: String!`, `avatar: String!`, `characters: [Character]`, and `guilds: [Guild]`. `UserData` has `currentUser: User` and `user: User` (with arguments).
- **Rate-limit schema:** `RateLimitData` has `currentRequest: JSON!`, `databaseLimitPerHour: Int!`, `databasePointsSpentThisHour: Int!`, `limitPerHour: Int!`, `pointsResetIn: Int!`, `pointsSpentThisHour: Float!`, `userHasRemainingPoints: Boolean`, and `userPointsResetIn: Int`.
- **Per-request cost:** `currentRequest` returned `{ "application": 0, "total": 1 }` for a user-endpoint rate-limit query. This suggests that the request cost one point, charged entirely to user points.
- **Rate-limit values:** the development client reported `limitPerHour` 3,600, `databaseLimitPerHour` 250, `userHasRemainingPoints` true, and `userPointsResetIn` 0.
- **Client-endpoint rate-limit fields, October 24, 2026:** `pnpm fellowship-logs:capture-report` for report `XdfFZzgHBJNr6m3v` fight 15, using the older non-public client's credentials on `/api/v2/client`, selected the slice 4.4 fields without errors. Both responses reported `limitPerHour` 1,000, `databaseLimitPerHour` 250, `databasePointsSpentThisHour` 0, and `userHasRemainingPoints` and `userPointsResetIn` both null, as expected without a signed-in user. `pointsSpentThisHour` rose from 1 to 5 across the metadata and report-page requests. Unlike the earlier user-endpoint reading of 3,600 for the development client, this older client reported the beta application limit of 1,000. Decided October 24, 2026: treat 1,000 as the application limit after opting into the beta API. The earlier 3,600 reading came before the account opted in, so `limitPerHour` now reports the beta limit.

Not yet established:

- **Loopback matching beyond the port:** it is unknown whether `localhost` or `[::1]` is accepted.
- **User-point quota:** there is no user-point limit or spent count. User points appear only as `userHasRemainingPoints`, `userPointsResetIn`, and the per-request `currentRequest` split.
- **`currentRequest` shape:** it is an untyped `JSON` scalar. The `application`/`total` shape was observed but is not documented.
- **Beta limit display:** before the account opted into the beta, `limitPerHour` reported the legacy 3,600-point limit, and the account page showed the same spend against both the 3,600 limit and the beta 1,000 limit. `databaseLimitPerHour` reports the beta value of 250. Superseded after the opt-in: `limitPerHour` reports the beta 1,000 limit (see the client-endpoint reading below).
- **Where probe points went:** after the four probe runs, the account page showed 23.00 request points spent, split into 22.84 app-only and 0.16 user-eligible. Per-request `currentRequest` readings of `{ "application": 0, "total": 1 }` therefore do not describe the whole session. Introspection and other non-user-eligible fields probably spent application points. User-eligible spending can be fractional, despite the documented one-point minimum.
- **BYO-client PKCE, October 24, 2026:** the client list labels only public clients with "PKCE". With `http://127.0.0.1:47892/oauth/callback` added to the older non-public client, which has a secret, `pnpm fellowship-logs:authorize --client-id <that client>` got a code back through the loopback listener. The token exchange without a client secret was then rejected (`ProviderRejected`). The provider error code was not captured. A non-public client can therefore start a PKCE authorization but cannot complete it without its secret. Whether the exchange succeeds with the secret plus the verifier is untested and no longer needed. Decided October 24, 2026: "Use my own client and sign in" requires a public client.
- **Portless loopback registration:** every successful run registered `http://127.0.0.1:47892/oauth/callback` and varied the port at authorization time. Whether a registration of `http://127.0.0.1/oauth/callback` without a port also matches any port is untested. The product keeps the proven fixed-port registration guidance, so the portless form is deferred and is not a release gate.
- **Point-policy probe:** `pnpm fellowship-logs:authorize --check-point-policy` reads the point label at the end of each field description the import queries select, and the `@onlySpendUserPoints` directive definition. It then runs each import-shaped query against report `XdfFZzgHBJNr6m3v` fight 15, both with default spending and with `@onlySpendUserPoints`, plus a query that mixes `fights` with a field that lacks the user-eligible label. For each query it records the status, errors, and `currentRequest` split. It cannot exhaust a point pool, so exhausted-pool behavior needs a separate deliberate run.
- **`@onlySpendUserPoints` requires an opt-in, October 24, 2026:** before the user opted into the new point system on Fellowship Logs, every query that used the directive was refused, including `rateLimitData` alone. Each returned HTTP 200 with no data and the GraphQL error "cannot require only user points be spent without authenticating a user and opting into the new point system". After the user opted in, the same queries succeeded.
- **Where the opt-in lives:** the opt-in was a button under Web API on the Fellowship Logs account settings page. After it was clicked, the button disappeared. The page said opting out requires contacting support. The page also states: "API keys created on or after 2026-09-29 are automatically opted into the beta API updates."
  - The development client ID is a version-7 UUID whose embedded timestamp is 2026-10-24T17:43:20Z, so the client was created after that date. Even so, `@onlySpendUserPoints` was refused until the account-level button was clicked.
  - The opt-in that the directive requires is therefore attached to an account, not only to the API key.
  - The account that owns the client and the account that signed in were the same, so it is unproven which account must be opted in. If it is the signed-in user, every user of the recommended profile must opt in on their own account, and that choice cannot be undone without contacting support. If it is the client owner, opting in once for the production client is enough.
  - Settle this by authorizing the development client with a second Fellowship Logs account that has not opted in, then running `--check-point-policy`.
  - Decided October 24, 2026: no second account is available, so plan for the worst case. Every user of "Connect with Fellowship Logs" must opt in on their own account. [04-api-point-policy.md](04-api-point-policy.md) records the design. Revisit if a second-account test shows that only the client owner needs the opt-in.
  - Live through the app's services, October 24, 2026: `pnpm fellowship-logs:authorize` authorized the development client as user `13100` on the opted-in account, then ran the slice 4.2 check, `query CheckPointSystemOptIn @onlySpendUserPoints { rateLimitData { currentRequest } }`, on the user endpoint. It returned `OPTED_IN`, and the stored connection status was `CONNECTED`. This proves the check's success path. The refusal path is covered only by fixtures, because this account cannot be un-opted without contacting support.
  - Only the directive needs the opt-in. In the first run, before the opt-in, the fight query with default spending already charged `{ "application": 0, "user": 4, "total": 4 }`. User-first spending therefore works without the opt-in, so "Use my own client and sign in" does not depend on it. The Archon and Fellowship Logs documentation pages sit behind a human-verification challenge and could not be read.
- **Directive definition:** the schema describes `@onlySpendUserPoints` as a `QUERY` directive with an optional `enabled` argument, which defaults to true. It errors when there is no OAuth user, and "If any non-user points would be spent on a field, that field errors". A one-point hold is always placed on the app key at the start of a request and released when the request succeeds or fails non-fatally, so every request needs at least one available app point.
- **Opted-in results, second run October 24, 2026,** with report `XdfFZzgHBJNr6m3v` fight 15. Each cell is the `currentRequest` split as application / user / total:

  | Query | Default spending | `@onlySpendUserPoints` |
  | --- | --- | --- |
  | `rateLimitData` only | 0 / none / 1 | 0 / none / 1 |
  | Fight query | 0 / 4 / 4 | 0 / 4 / 4 |
  | Dungeon-run metadata query | 0 / 4 / 4 | 0 / 4 / 4 |
  | Report events query (import shape, fight window) | 0 / 6.68 / 6.68 | 0 / 5 / 5 |
  | `fights` plus `rankings` | 50 (2 database) / 4 / 54 | 0 / 4 / 4, with an error |

  - Every import-shaped query succeeded under `@onlySpendUserPoints` with zero application points, so the recommended profile's user-only policy works for imports.
  - A mixed query under the directive is a partial success, not a refusal. It returned HTTP 200 with the `fights` data and the error "attempted to spend non-user points while the @onlySpendUserPoints directive was enabled" for `rankings`, and charged only user points. Without the directive, the user-eligible part went to user points and `rankings` went to application points.
  - Point labels sit on the top-level report fields. `events`, `fights`, and `masterData` end with `[User-Eligible Points]`. `rankings` ends with `[Database Points]`. Subfields, report scalars, `reportData`, `report`, and `rateLimitData` have no label, and selecting them added no application cost.
  - User spending can be fractional, as the 6.68 shows. The events query cost less under the directive than in the earlier default run of the same query.
- **Release-blocking provider evidence:** live user-pool exhaustion and reset recovery, plus live application-pool exhaustion and the one-point shared hold behavior, remain open because they can invalidate the implemented waiting and recovery flow.
- **Conservative assumptions:** opt-in ownership uses the worst case and requires each signed-in user to follow the opt-in flow; stale codes are bounded by the app's ten-minute transaction expiry and one-time exchange; Disconnect remains local-only unless a revocation endpoint is proven. These are not release blockers. Custom-scheme and HTTPS redirects remain deferred unless the loopback architecture needs to be revisited.

Design consequences:

- Store the connected-user ID as a string converted from the numeric `currentUser.id`, or change `FellowshipLogsConnectedUserIdSchema` to match `Int!`.
- A 360-day access token makes refresh rare but the stored token long-lived. Protected storage and disconnect revocation carry more weight.
- Refresh must persist the new access and refresh tokens together before using either one, because the previous access token and refresh token both stop working immediately.
- Removing the app under Authorized Applications leaves issued tokens working, and a refresh token keeps issuing new pairs. Disconnect can only delete local copies, so a leaked refresh token stays usable until it expires. Disconnect copy must not suggest that removing the app on Fellowship Logs revokes access.
- The provider does not revoke a token family when a stale refresh token is reused, so it does not detect refresh-token theft. Local protection is the only defense for a stored refresh token.
- `currentRequest` can confirm per request that a strict user-only query spent zero application points. That supports the point-policy enforcement and the local point-usage history.
- Under `@onlySpendUserPoints`, a field that would spend non-user points errors while the rest of the query succeeds. The gateway must treat any GraphQL error in a strict query as a failed request, never accept the partial data, and classify this error separately from quota exhaustion.
- Every import query can run strictly on user points, so the recommended profile does not need application points except for the one-point hold.
- The recommended profile depends on an account-level opt-in to the new point system. Connection setup must detect the refusal error. If the opt-in turns out to be per user, setup must explain the account setting and that opting out requires contacting support. Before release, the maintainer account that owns the production client must be opted in.
- The quota UI cannot show remaining user points. It can show only whether any remain and when they reset.
- Callback validation must accept the denial shape, `error`, `error_description`, `hint`, and `state`, check `state`, and classify `access_denied` as a user cancellation rather than a failure.
- Returning users skip the consent screen, so reconnecting can complete without any visible provider page. The app's own UI must make clear which profile and account are being connected.
- A redirect mismatch never returns to the app. The browser shows raw `invalid_client` JSON instead. The app needs a visible pending state with Cancel and a timeout. For the own-client-and-sign-in profile, setup must tell the user exactly which redirect URI to register, because a wrong registration looks like an invalid client ID.
- An ephemeral-port loopback redirect is viable. The app can listen on a free `127.0.0.1` port for each authorization, which avoids port conflicts.

### Redirect architecture decision

Decided October 24, 2026: use the ephemeral-port loopback redirect and defer the hosted HTTPS callback bridge. [03-oauth-and-electron-callback.md](03-oauth-and-electron-callback.md) records the design and the triggers for revisiting the bridge. The domain, DNS, and callback-hosting research below is retained for that case and is not part of the current scope.

### Requires a development OAuth client

The remaining gates listed under "Not yet established" above stay open until the development client proves them.

## Callback infrastructure

Deferred. This section applies only if the hosted HTTPS callback bridge returns.

Plan on a stable `auth.<domain>` HTTPS redirect. Register the domain through AWS Route 53 and prefer Route 53 for authoritative DNS so domain ownership and DNS operations remain centralized in AWS.

Use Cloudflare Pages as the current callback-hosting choice. Cloudflare documents that a custom subdomain can remain outside a Cloudflare zone: associate the subdomain with the Pages project, then create a Route 53 CNAME such as `auth.<domain>` pointing to the project's `*.pages.dev` hostname. This preserves Route 53 as authoritative DNS while retaining Cloudflare-managed HTTPS and response-header controls.

Do not select a Cloudflare Workers custom domain unless later requirements justify moving DNS authority or another proven routing arrangement. Consider moving authoritative DNS to Cloudflare only if measured savings or required capabilities are significant enough to justify splitting domain registration and DNS operations across providers.

Before purchasing a domain, compare:

- normal and premium registration price;
- renewal and transfer price;
- registrant ownership and transfer controls;
- DNSSEC;
- WHOIS privacy;
- multi-factor authentication and account recovery;
- support reputation;
- registrar lock and transfer process.

Route 53 currently charges $0.50 per hosted zone per month and $0.40 per million standard queries. At callback-bridge scale, the expected DNS premium over Cloudflare's free authoritative DNS is therefore approximately $6 per year plus negligible query charges. This is not a significant saving relative to the operational preference for centralized AWS registration and DNS. Revisit the decision if traffic assumptions change or Cloudflare requires its own nameservers for a future hosting capability.

The domain registration price depends on the chosen domain and TLD. Record its actual registration and renewal prices from the Route 53 console before purchase; Route 53 does not support special or premium-priced registrations.

The domain must remain portable across hosts. Domain search, purchase, billing, registrar recovery configuration, and production DNS changes are human steps.

## Static callback requirements

The callback bridge:

- receives only allowlisted OAuth response fields;
- retains no verifier, client secret, or token;
- removes the query string from visible history immediately;
- attempts the registered custom protocol;
- provides an explicit Open App action;
- provides one complete callback payload for copy/paste fallback;
- contains no analytics, fonts, tag managers, error SDKs, service worker, or third-party resources;
- sends strict CSP, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, framing protection, MIME sniffing protection, and `X-Robots-Tag: noindex`;
- avoids application logging of the request URL.

The hosting provider may observe the original request URL at its edge. The accepted risk is bounded by short-lived, single-use, PKCE-bound authorization codes. Re-evaluate the bridge if Fellowship Logs supports a direct custom scheme, loopback redirect, or `form_post` with better privacy and equivalent recovery.

## Sources

- [Archon API beta announcement](https://www.archon.gg/eso/articles/help/archon-api-updates-beta)
- [Logs OAuth documentation](https://www.warcraftlogs.com/api/docs)
- [Cloudflare Registrar](https://developers.cloudflare.com/registrar/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages headers](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Amazon Route 53 domain registration](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/domain-register.html)
- [Amazon Route 53 pricing](https://aws.amazon.com/route53/pricing/)
- [Netlify credit pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)
- [GitHub Pages limits](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/github-pages-limits)

## Complete when

- Every release-blocking provider behavior has dated evidence, or the design changes before release.
- The redirect architecture follows proven provider behavior.
- Development and production registrations are distinct and reproducible.
- If the HTTPS bridge returns, the Route 53 decision records current costs and ownership controls, and the callback host serves the required security headers over HTTPS.

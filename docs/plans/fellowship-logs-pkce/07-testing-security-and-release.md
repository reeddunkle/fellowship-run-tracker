# Testing, security, and release

## Automated coverage

Cover:

- PKCE verifier, challenge, state, expiry, cancellation, and replay;
- connection-state transitions and invalid-state rejection;
- protected-storage success, failure, backward-compatible local-key reads, and acknowledged fallback;
- endpoint and directive selection for all profiles;
- provider response decoding for every quota pool;
- strict-mode refusal of application-only operations;
- token expiry, refresh, rotation, denial, and reauthorization according to proven behavior;
- job waiting, resumption, cancellation, and deliberate profile transition;
- whole-workflow point accounting and estimate inclusion rules;
- loopback listener lifecycle, exact-path acceptance, and malformed callbacks;
- atomic connection replacement across credential-check and OAuth races;
- one-lease point-system opt-in checks across connection changes;
- durable lookup-workflow correlation across concurrency, duplicate queue requests, restart, expiry, and mismatch;
- redaction across logs, OTLP spans, analytics persistence, API errors, renderer errors, and Electron crash-handler log output.

Use controlled clocks and deterministic provider fixtures. Integration tests exercise the real process boundaries without contacting Fellowship Logs. Add one narrow renderer-client-to-real-local-HTTP-API workflow so component mocks and route tests are not the only contract coverage. Shared mocks fail loudly for every unexpected call. A separate documented manual suite proves provider behavior.

The existing authorization, token, listener, queue, point-policy, and cost-accounting suites cover high-value state-machine and concurrency behavior and remain. Split the authorization integration suite by lifecycle, completion and recovery, concurrency, and security for navigation without removing behavioral assertions.

## Windows release matrix

Test on a clean supported Windows environment:

- fresh install and portable ZIP;
- approval, provider denial, and cancellation from the app;
- returning-user authorization that skips the consent screen;
- stale, replayed, malformed, and mismatched callbacks;
- redirect mismatch that never reaches the listener and ends at expiry;
- manual copy/paste fallback;
- app unable to launch the browser;
- no firewall prompt for the `127.0.0.1` listener;
- token expiry during an import;
- quota exhaustion and reset resumption;
- upgrade and uninstall;
- OS-backed protection and acknowledged local fallback.

## Security review

Review the loopback callback listener, IPC boundary, local HTTP boundary, renderer contract, token exchange, persistence, and observability as one attack surface.

Verify:

- exact callback origin and path validation;
- state binding to one pending transaction;
- one-time code exchange;
- renderer isolation from protected values;
- no open redirect or arbitrary protocol launch;
- the loopback listener binds only to `127.0.0.1`, accepts only the exact callback path once, and closes with its transaction;
- the callback response page loads no resources and sends `no-store` and `no-referrer`;
- no token or secret in process arguments;
- marker secrets cannot reach logs, OTLP spans, analytics persistence, renderer errors, API errors, or Electron crash-handler log output.

The application currently opens the logs folder but does not produce a diagnostic export. Add export-specific review and tests only if such a feature is introduced.

## Release preparation

- Confirm the release-blocking provider gates in the overview: live user-pool exhaustion and reset recovery, and live application-pool exhaustion including the one-point shared hold.
- Confirm production client name and redirect shown during consent.
- Confirm the production client contains no bundled secret.
- Confirm quota policy values and source date.
- Confirm installer signing.
- Confirm support copy describes only tested platforms.
- Confirm the production client registers `http://127.0.0.1:47892/oauth/callback`.

Unknown opt-in ownership, portless registration, missing client-endpoint `currentRequest`, stale-code expiry, and an unknown revocation endpoint are conservative assumptions documented in [08-path-forward.md](08-path-forward.md), not release blockers.

## Deferred platform follow-ups

Create and complete dedicated macOS and Linux plans before claiming support. Each covers packaging, OS-backed secure storage, the loopback listener and firewall behavior, manual fallback, uninstall cleanup, and distribution-specific behavior.

## Complete when

- Automated suites pass with no sensitive-value leakage.
- Every Windows matrix row has recorded evidence.
- The provider manual suite has current results.
- Security review findings are resolved or explicitly accepted.
- Release notes and UI make no unsupported platform or revocation claim.
- A strict user-only import completes without spending the maintainer's application points.
- A refused opt-in check leaves the connection in point-system opt-in required, sends no import request, and recovers after a successful recheck.
- The maintainer account that owns the production client is opted into the new point system.

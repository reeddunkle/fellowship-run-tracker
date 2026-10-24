import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-pkce.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsConfiguredRedirectUriSchema } from "@frt/api/validation/fellowship-logs-oauth-config-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const isAllowedRedirectUri = Schema.is(
  FellowshipLogsConfiguredRedirectUriSchema,
);

describe("Fellowship Logs PKCE", () => {
  test("derives the RFC 7636 S256 code challenge", async () => {
    const challenge = await Redacted.make(
      "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    ).pipe(deriveCodeChallenge, runTest);

    expect(Redacted.value(challenge)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });

  test("generates unique verifiers and states within the RFC 7636 alphabet", async () => {
    const values = await E.gen(function* () {
      const verifiers = yield* E.replicateEffect(generateCodeVerifier, 20);
      const states = yield* E.replicateEffect(generateOAuthState, 20);

      return [...verifiers.map(Redacted.value), ...states];
    }).pipe(runTest);

    expect(new Set(values).size).toBe(values.length);

    for (const value of values) {
      expect(value).toMatch(/^[A-Za-z0-9\-._~]{43,128}$/u);
    }
  });

  test("builds the authorization URL with exactly the PKCE parameters", () => {
    const url = new URL(
      Redacted.value(
        buildAuthorizationUrl({
          clientId: Schema.decodeSync(FellowshipLogsClientIdSchema)(
            "client-id",
          ),
          codeChallenge: Redacted.make("code-challenge"),
          redirectUri: Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
            "http://127.0.0.1:47892/oauth/callback",
          ),
          state: Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state"),
        }),
      ),
    );

    expect(url.origin + url.pathname).toBe(
      "https://www.fellowshiplogs.com/oauth/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-id",
      code_challenge: "code-challenge",
      code_challenge_method: "S256",
      redirect_uri: "http://127.0.0.1:47892/oauth/callback",
      response_type: "code",
      state: "state",
    });
    expect([...url.searchParams.keys()]).toHaveLength(6);
  });

  test("allows only 127.0.0.1 loopback redirect URIs", () => {
    for (const redirectUri of [
      "http://127.0.0.1:47892/oauth/callback",
      "http://127.0.0.1:51234/oauth/callback",
    ]) {
      expect(isAllowedRedirectUri(redirectUri)).toBe(true);
    }

    for (const redirectUri of [
      "https://auth.example.com/oauth/callback",
      "http://auth.example.com/oauth/callback",
      "http://localhost:47892/oauth/callback",
      "https://127.0.0.1:47892/oauth/callback",
      "http://127.0.0.1:47892/oauth/callback?next=elsewhere",
      "http://127.0.0.1:47892/oauth/callback#fragment",
      "http://user@127.0.0.1:47892/oauth/callback",
      "fellowship-run-tracker://oauth/callback",
      "javascript:alert(1)",
      "",
    ]) {
      expect(isAllowedRedirectUri(redirectUri)).toBe(false);
    }
  });
});

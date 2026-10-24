import { Buffer } from "node:buffer";

import type * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { FELLOWSHIP_LOGS_AUTHORIZATION_URL } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-urls.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsOAuthState,
  FellowshipLogsOAuthStateSchema,
  type FellowshipLogsRedirectUri,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const RANDOM_VALUE_BYTE_LENGTH = 32;

const PKCE_CODE_CHALLENGE_METHOD = "S256";

type AuthorizationUrlOptions = {
  readonly clientId: FellowshipLogsClientId;
  readonly codeChallenge: Redacted.Redacted<string>;
  readonly redirectUri: FellowshipLogsRedirectUri;
  readonly state: FellowshipLogsOAuthState;
};

const generateRandomValue = E.sync(() => {
  return Buffer.from(
    crypto.getRandomValues(new Uint8Array(RANDOM_VALUE_BYTE_LENGTH)),
  ).toString("base64url");
});

export const generateCodeVerifier = generateRandomValue.pipe(
  E.map((value) => Redacted.make(value)),
);

export const generateOAuthState = generateRandomValue.pipe(
  E.map((value) => FellowshipLogsOAuthStateSchema.make(value)),
);

export const deriveCodeChallenge: (
  codeVerifier: Redacted.Redacted<string>,
) => E.Effect<Redacted.Redacted<string>, Cause.UnknownError> = E.fn(
  "deriveCodeChallenge",
)(function* (codeVerifier) {
  const digest = yield* E.tryPromise(() => {
    return crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(Redacted.value(codeVerifier)),
    );
  });

  return Redacted.make(Buffer.from(digest).toString("base64url"));
});

export function buildAuthorizationUrl({
  clientId,
  codeChallenge,
  redirectUri,
  state,
}: AuthorizationUrlOptions) {
  const url = new URL(FELLOWSHIP_LOGS_AUTHORIZATION_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("code_challenge", Redacted.value(codeChallenge));
  url.searchParams.set("code_challenge_method", PKCE_CODE_CHALLENGE_METHOD);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return Redacted.make(url.toString());
}

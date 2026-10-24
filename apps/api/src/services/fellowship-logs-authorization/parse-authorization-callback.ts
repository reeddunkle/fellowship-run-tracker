import * as Redacted from "effect/Redacted";

import { type FellowshipLogsRedirectUri } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const APPROVAL_PARAMETERS = new Set(["code", "state"]);
const DENIAL_REQUIRED_PARAMETERS = ["error", "state"];
const DENIAL_PARAMETERS = new Set([
  "error",
  "error_description",
  "hint",
  "state",
]);

export type AuthorizationCallback =
  | {
      readonly _tag: "Approved";
      readonly code: Redacted.Redacted<string>;
      readonly state: string;
    }
  | {
      readonly _tag: "Denied";
      readonly error: string;
      readonly state: string;
    };

function parseUrl(value: string) {
  return URL.canParse(value) ? new URL(value) : null;
}

function matchesRedirectUri(url: URL, redirectUri: URL) {
  return (
    url.protocol === redirectUri.protocol &&
    url.hostname === redirectUri.hostname &&
    url.port === redirectUri.port &&
    url.pathname === redirectUri.pathname &&
    url.username === "" &&
    url.password === "" &&
    url.hash === ""
  );
}

function getSingleValues(searchParams: URLSearchParams) {
  const names = Array.from(searchParams.keys());

  if (new Set(names).size !== names.length) {
    return null;
  }

  return new Map(
    names.map((name) => {
      return [name, searchParams.get(name) ?? ""];
    }),
  );
}

function hasExactlyNames(
  values: ReadonlyMap<string, string>,
  allowed: ReadonlySet<string>,
) {
  return Array.from(values.keys()).every((name) => allowed.has(name));
}

export function parseAuthorizationCallback(
  callbackUrl: string,
  redirectUri: FellowshipLogsRedirectUri,
): AuthorizationCallback | null {
  const url = parseUrl(callbackUrl.trim());
  const expected = parseUrl(redirectUri);

  if (url === null || expected === null || !matchesRedirectUri(url, expected)) {
    return null;
  }

  const values = getSingleValues(url.searchParams);
  const state = values?.get("state");

  if (values === null || state === undefined || state === "") {
    return null;
  }

  const code = values.get("code");

  if (
    code !== undefined &&
    code !== "" &&
    values.size === APPROVAL_PARAMETERS.size &&
    hasExactlyNames(values, APPROVAL_PARAMETERS)
  ) {
    return { _tag: "Approved", code: Redacted.make(code), state };
  }

  const error = values.get("error");

  if (
    error !== undefined &&
    error !== "" &&
    DENIAL_REQUIRED_PARAMETERS.every((name) => values.has(name)) &&
    hasExactlyNames(values, DENIAL_PARAMETERS)
  ) {
    return { _tag: "Denied", error, state };
  }

  return null;
}

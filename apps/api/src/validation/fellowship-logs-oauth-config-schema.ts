import * as Schema from "effect/Schema";

import { FellowshipLogsRedirectUriSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const LOOPBACK_REDIRECT_HOSTNAME = "127.0.0.1";

function parseUrl(value: string) {
  return URL.canParse(value) ? new URL(value) : null;
}

function hasOnlyOriginAndPath(url: URL) {
  return (
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === ""
  );
}

function isAllowedRedirectUri(value: string) {
  const url = parseUrl(value);

  return (
    url !== null &&
    url.protocol === "http:" &&
    url.hostname === LOOPBACK_REDIRECT_HOSTNAME &&
    hasOnlyOriginAndPath(url)
  );
}

export const FellowshipLogsConfiguredRedirectUriSchema =
  FellowshipLogsRedirectUriSchema.check(
    Schema.makeFilter(isAllowedRedirectUri, {
      message: "Expected an http://127.0.0.1 loopback redirect URI.",
    }),
  );

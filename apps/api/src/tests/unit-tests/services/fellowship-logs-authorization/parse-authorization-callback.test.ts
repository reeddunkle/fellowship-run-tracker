import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { parseAuthorizationCallback } from "@frt/api/services/fellowship-logs-authorization/parse-authorization-callback.ts";
import { FellowshipLogsRedirectUriSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const REDIRECT_URI = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
  "http://127.0.0.1:51234/oauth/callback",
);

function parse(query: string, base: string = REDIRECT_URI) {
  return parseAuthorizationCallback(`${base}?${query}`, REDIRECT_URI);
}

describe("parseAuthorizationCallback", () => {
  test("parses an approval with exactly code and state", () => {
    const callback = parse("code=the-code&state=the-state");

    expect(callback?._tag).toBe("Approved");
    expect(
      callback?._tag === "Approved" ? Redacted.value(callback.code) : null,
    ).toBe("the-code");
    expect(callback?.state).toBe("the-state");
  });

  test("keeps the authorization code redacted", () => {
    const callback = parse("code=the-code&state=the-state");

    expect(
      String(callback?._tag === "Approved" ? callback.code : ""),
    ).not.toContain("the-code");
  });

  test("parses the observed denial shape", () => {
    expect(
      parse(
        "error=access_denied&error_description=The+resource+owner+denied+the+request.&hint=&state=the-state",
      ),
    ).toEqual({ _tag: "Denied", error: "access_denied", state: "the-state" });
  });

  test("parses a denial without the optional description or hint", () => {
    expect(parse("error=access_denied&state=the-state")).toEqual({
      _tag: "Denied",
      error: "access_denied",
      state: "the-state",
    });
  });

  test("accepts surrounding whitespace from a manual paste", () => {
    expect(
      parseAuthorizationCallback(
        `  ${REDIRECT_URI}?code=the-code&state=the-state\n`,
        REDIRECT_URI,
      )?._tag,
    ).toBe("Approved");
  });

  test.each([
    ["a missing state", "code=the-code"],
    ["an empty state", "code=the-code&state="],
    ["an empty code", "code=&state=the-state"],
    ["a duplicate code", "code=a&code=b&state=the-state"],
    ["a duplicate state", "code=the-code&state=a&state=b"],
    ["an unexpected approval parameter", "code=the-code&state=s&scope=all"],
    ["both a code and an error", "code=the-code&error=access_denied&state=s"],
    ["an unexpected denial parameter", "error=access_denied&state=s&next=x"],
    ["an empty error", "error=&state=the-state"],
    ["no parameters", ""],
  ])("rejects %s", (_name, query) => {
    expect(parse(query)).toBeNull();
  });

  test.each([
    ["a different path", "http://127.0.0.1:51234/oauth/other"],
    ["a different port", "http://127.0.0.1:51235/oauth/callback"],
    ["a different host", "http://localhost:51234/oauth/callback"],
    ["a different scheme", "https://127.0.0.1:51234/oauth/callback"],
    ["credentials", "http://user@127.0.0.1:51234/oauth/callback"],
  ])("rejects %s", (_name, base) => {
    expect(parse("code=the-code&state=the-state", base)).toBeNull();
  });

  test("rejects a fragment", () => {
    expect(
      parseAuthorizationCallback(
        `${REDIRECT_URI}?code=the-code&state=the-state#fragment`,
        REDIRECT_URI,
      ),
    ).toBeNull();
  });

  test("rejects input that is not a URL", () => {
    expect(
      parseAuthorizationCallback("code=the-code&state=the-state", REDIRECT_URI),
    ).toBeNull();
  });
});

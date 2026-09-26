import { describe, expect, test } from "vitest";

import { makeUserPathRedactor } from "@frt/api/logging/redact-user-paths.ts";

const redactWindowsPaths = makeUserPathRedactor(String.raw`C:\Users\reed`);

describe("makeUserPathRedactor", () => {
  test("redacts raw, JSON-escaped, and forward-slash Windows paths", () => {
    expect(
      redactWindowsPaths(String.raw`C:\Users\reed\AppData\Local\logs`),
    ).toBe(String.raw`~\AppData\Local\logs`);

    expect(
      redactWindowsPaths(String.raw`{"path":"C:\\Users\\reed\\AppData"}`),
    ).toBe(String.raw`{"path":"~\\AppData"}`);

    expect(redactWindowsPaths("file:///C:/Users/reed/app/main.js")).toBe(
      "file:///~/app/main.js",
    );
  });

  test("matches regardless of case", () => {
    expect(redactWindowsPaths(String.raw`c:\users\REED\file.txt`)).toBe(
      String.raw`~\file.txt`,
    );
  });

  test("redacts every path in a stack trace", () => {
    const stack = [
      "Error: failed",
      String.raw`    at run (C:\Users\reed\app\main.js:10:5)`,
      String.raw`    at load (C:\Users\reed\app\loader.js:2:1)`,
    ].join("\n");

    expect(redactWindowsPaths(stack)).not.toContain("reed");
  });

  test("keeps JSON log lines parseable", () => {
    const line = JSON.stringify({
      cause: String.raw`ENOENT: C:\Users\reed\missing.txt`,
      message: "Failed.",
    });

    expect(JSON.parse(redactWindowsPaths(line))).toEqual({
      cause: String.raw`ENOENT: ~\missing.txt`,
      message: "Failed.",
    });
  });

  test("leaves other users and longer names untouched", () => {
    expect(redactWindowsPaths(String.raw`C:\Users\reeder\file.txt`)).toBe(
      String.raw`C:\Users\reeder\file.txt`,
    );
    expect(redactWindowsPaths("No paths here.")).toBe("No paths here.");
  });

  test("redacts POSIX home directories", () => {
    const redactPosixPaths = makeUserPathRedactor("/home/reed");

    expect(redactPosixPaths("/home/reed/.config/app.log")).toBe(
      "~/.config/app.log",
    );
  });

  test("does nothing when there is no home directory", () => {
    expect(makeUserPathRedactor("")("C:\\Users\\reed")).toBe("C:\\Users\\reed");
    expect(makeUserPathRedactor("/")("/etc/hosts")).toBe("/etc/hosts");
  });
});

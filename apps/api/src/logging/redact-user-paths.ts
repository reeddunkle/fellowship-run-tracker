import os from "node:os";

const REDACTED_HOME_DIRECTORY = "~";

const SEPARATOR_PATTERN = String.raw`(?:\\\\|\\|/)`;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeHomeDirectoryPattern(homeDirectory: string) {
  const segments = homeDirectory.split(/[\\/]+/).filter((segment) => {
    return segment.length > 0;
  });

  if (segments.length === 0) {
    return undefined;
  }

  const leadingSeparator = /^[\\/]/.test(homeDirectory)
    ? SEPARATOR_PATTERN
    : "";

  return new RegExp(
    `${leadingSeparator}${segments.map(escapeRegExp).join(SEPARATOR_PATTERN)}(?![\\w-])`,
    "gi",
  );
}

export function makeUserPathRedactor(homeDirectory: string) {
  const pattern = makeHomeDirectoryPattern(homeDirectory);

  return (text: string) => {
    return pattern === undefined
      ? text
      : text.replace(pattern, REDACTED_HOME_DIRECTORY);
  };
}

export const redactUserPaths = makeUserPathRedactor(os.homedir());

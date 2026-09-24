import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { COMMENT_MARKERS } from "./comment-policy/comment-markers.ts";

type ToolInput = {
  readonly content?: string;
  readonly edits?: readonly {
    readonly new_string?: string;
    readonly old_string?: string;
  }[];
  readonly file_path?: string;
  readonly new_string?: string;
  readonly old_string?: string;
};

type HookInput = {
  readonly tool_input?: ToolInput;
};

const PROJECT_ROOT = path.resolve(import.meta.dirname, "../../..");

const OXLINT_BIN_PATH = path.join(
  PROJECT_ROOT,
  "node_modules/oxlint/bin/oxlint",
);

const CHECKED_EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".ts", ".tsx"]);

function countMarkers(text: string): number {
  return COMMENT_MARKERS.reduce(
    (count, marker) => count + text.split(marker).length - 1,
    0,
  );
}

function getEditedText(filePath: string, toolInput: ToolInput) {
  if (toolInput.content !== undefined) {
    return {
      after: toolInput.content,
      before: existsSync(filePath) ? readFileSync(filePath, "utf8") : "",
    };
  }

  const edits = toolInput.edits ?? [toolInput];

  return {
    after: edits.map((edit) => edit.new_string ?? "").join("\n"),
    before: edits.map((edit) => edit.old_string ?? "").join("\n"),
  };
}

function denyAddedMarkers(filePath: string, toolInput: ToolInput): void {
  const { after, before } = getEditedText(filePath, toolInput);

  if (countMarkers(after) <= countMarkers(before)) {
    return;
  }

  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `The ${COMMENT_MARKERS.join(" and ")} comment markers are reserved for the user. Don't add them; leave the comment out instead.`,
      },
    }),
  );
}

function reportUnmarkedComments(filePath: string): void {
  try {
    execFileSync(
      process.execPath,
      [
        OXLINT_BIN_PATH,
        "--no-error-on-unmatched-pattern",
        "--format",
        "unix",
        filePath,
      ],
      { cwd: PROJECT_ROOT, encoding: "utf8", stdio: "pipe" },
    );
  } catch (error) {
    const output =
      error instanceof Error && "stdout" in error ? String(error.stdout) : "";

    console.error(
      `Remove these comments; only the user adds comments to this project.\n${output}`,
    );
    process.exit(2);
  }
}

const mode = process.argv[2];

const { tool_input: hookToolInput }: HookInput = JSON.parse(
  readFileSync(0, "utf8"),
);

const editedFilePath = hookToolInput?.file_path;

if (
  hookToolInput !== undefined &&
  editedFilePath !== undefined &&
  CHECKED_EXTENSIONS.has(path.extname(editedFilePath))
) {
  if (mode === "pre") {
    denyAddedMarkers(editedFilePath, hookToolInput);
  } else if (mode === "post") {
    reportUnmarkedComments(editedFilePath);
  }
}

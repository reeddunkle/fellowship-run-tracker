import path from "node:path";

import { type Comment, definePlugin, defineRule } from "@oxlint/plugins";

import { COMMENT_MARKERS } from "./comment-markers.ts";

const JS_EXTENSIONS = new Set([".cjs", ".js", ".mjs"]);

const DIRECTIVE_PATTERN =
  /^(?:@effect-diagnostics|@ts-(?:check|expect-error|ignore|nocheck)\b|biome-ignore|oxlint-disable|oxlint-enable|@vitest-environment\b|@vite-ignore\b|[@#]__(?:NO_SIDE_EFFECTS|PURE)__|<reference\s)/;

const JS_TYPE_ANNOTATION_PATTERN = /^@(?:import|satisfies|type|typedef)\b/;

const LINE_BREAK_ONLY_PATTERN = /^[ \t]*\r?\n[ \t]*$/;

type ClassifiedComment = {
  readonly comment: Comment;
  readonly isAllowed: boolean;
  readonly isDirective: boolean;
};

function getCommentBody(comment: Comment): string {
  return comment.type === "Line"
    ? comment.value.replace(/^\/+/, "").trim()
    : comment.value.replace(/^[\s*]+/, "").trim();
}

function classifyComment(
  comment: Comment,
  isJsFile: boolean,
): ClassifiedComment {
  const body = getCommentBody(comment);

  const isDirective =
    DIRECTIVE_PATTERN.test(body) ||
    (isJsFile && JS_TYPE_ANNOTATION_PATTERN.test(body));

  return {
    comment,
    isAllowed:
      isDirective || COMMENT_MARKERS.some((marker) => body.startsWith(marker)),
    isDirective,
  };
}

function isContinuation(
  text: string,
  previous: ClassifiedComment,
  current: ClassifiedComment,
): boolean {
  return (
    previous.comment.type === "Line" &&
    current.comment.type === "Line" &&
    !previous.isDirective &&
    !current.isDirective &&
    LINE_BREAK_ONLY_PATTERN.test(
      text.slice(previous.comment.end, current.comment.start),
    )
  );
}

function groupComments(
  text: string,
  comments: readonly ClassifiedComment[],
): ClassifiedComment[][] {
  return comments.reduce<ClassifiedComment[][]>((groups, comment) => {
    const lastGroup = groups.at(-1);
    const previous = lastGroup?.at(-1);

    if (
      lastGroup !== undefined &&
      previous !== undefined &&
      isContinuation(text, previous, comment)
    ) {
      lastGroup.push(comment);
    } else {
      groups.push([comment]);
    }

    return groups;
  }, []);
}

const requireCommentMarkerRule = defineRule({
  create(context) {
    return {
      Program() {
        const isJsFile = JS_EXTENSIONS.has(path.extname(context.filename));

        const comments = context.sourceCode
          .getAllComments()
          .filter((comment) => comment.type !== "Shebang")
          .map((comment) => classifyComment(comment, isJsFile));

        const violations = groupComments(context.sourceCode.text, comments)
          .map((group) => group[0])
          .filter(
            (first): first is ClassifiedComment =>
              first !== undefined && !first.isAllowed,
          );

        for (const violation of violations) {
          context.report({ messageId: "unmarked", node: violation.comment });
        }
      },
    };
  },
  meta: {
    messages: {
      unmarked: `Comment isn't allowed. Remove it; only the user adds comments, marked ${COMMENT_MARKERS.join(" or ")}.`,
    },
    type: "suggestion",
  },
});

export default definePlugin({
  meta: { name: "comment-policy" },
  rules: { "require-comment-marker": requireCommentMarkerRule },
});

export const getErrorTag = (error: unknown): string | undefined => {
  if (
    typeof error !== "object" ||
    error === null ||
    !("_tag" in error) ||
    typeof error._tag !== "string"
  ) {
    return undefined;
  }

  return error._tag;
};

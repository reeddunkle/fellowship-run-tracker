import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

const FIELD_SEPARATOR = "|";

const decodeTimestamp = Schema.decodeUnknownOption(
  Schema.DateTimeUtcFromString,
);

export function getFellowshipLogStartedAt(
  leadingText: string,
): Option.Option<number> {
  const separatorIndex = leadingText.indexOf(FIELD_SEPARATOR);

  if (separatorIndex === -1) {
    return Option.none();
  }

  return decodeTimestamp(leadingText.slice(0, separatorIndex)).pipe(
    Option.map(DateTime.toEpochMillis),
  );
}

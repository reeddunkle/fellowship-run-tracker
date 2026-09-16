import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";

import { NonNegativeIntegerSchema } from "@/validation/common-schemas.ts";

const invalidMessage = "Expected MM:SS, MM:SS.mmm, or decimal minutes format";

export function parseColonTime(value: string): number | undefined {
  const match = /^(\d+):([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value);

  if (match === null) {
    return undefined;
  }

  const minutesValue = match[1];
  const secondsValue = match[2];
  const fractionalValue = match[3];

  if (minutesValue === undefined || secondsValue === undefined) {
    return undefined;
  }

  const minutes = Number(minutesValue);
  const seconds = Number(secondsValue);
  const milliseconds =
    fractionalValue === undefined ? 0 : Number(fractionalValue.padEnd(3, "0"));

  return minutes * 60_000 + seconds * 1_000 + milliseconds;
}

export function parseDecimalMinutes(value: string): number | undefined {
  if (!/^\d+(?:\.\d+)?$/.test(value)) {
    return undefined;
  }

  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return undefined;
  }

  return Math.round(minutes * 60_000);
}

export function formatComparisonTime(value: number | null): string {
  if (value === null) {
    return "";
  }

  const minutes = Math.floor(value / 60_000);
  const remainingMilliseconds = value % 60_000;
  const seconds = Math.floor(remainingMilliseconds / 1_000);
  const milliseconds = remainingMilliseconds % 1_000;

  const secondsValue = seconds.toString().padStart(2, "0");

  if (milliseconds === 0) {
    return `${minutes}:${secondsValue}`;
  }

  return `${minutes}:${secondsValue}.${milliseconds
    .toString()
    .padStart(3, "0")}`;
}

export const ComparisonTimeFormSchema = Schema.String.pipe(
  Schema.decodeTo(Schema.NullOr(NonNegativeIntegerSchema), {
    decode: SchemaGetter.transformOrFail((value) => {
      if (value === "") {
        return E.succeed(null);
      }

      const milliseconds = parseColonTime(value) ?? parseDecimalMinutes(value);

      if (milliseconds === undefined) {
        return E.fail(
          new SchemaIssue.InvalidValue({
            message: invalidMessage,
          }),
        );
      }

      return E.succeed(milliseconds);
    }),
    encode: SchemaGetter.transform(formatComparisonTime),
  }),
);

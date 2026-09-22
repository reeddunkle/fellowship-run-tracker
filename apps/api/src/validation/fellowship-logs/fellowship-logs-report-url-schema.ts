import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";

import { FellowshipLogsApiDungeonRunReferenceSchema } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

const REPORTS_PATH_SEGMENT = "reports";
const FIGHT_QUERY_PARAM = "fight";

function invalidValue(message: string) {
  return new SchemaIssue.InvalidValue({
    message,
  });
}

function parseReportUrl(input: string) {
  return E.gen(function* () {
    const url = yield* E.try({
      catch: () => {
        return invalidValue("Enter a valid Fellowship Logs report URL.");
      },
      try: () => new URL(input),
    });

    const pathSegments = url.pathname.split("/").filter((segment) => {
      return segment.length > 0;
    });

    const reportsSegmentIndex = pathSegments.indexOf(REPORTS_PATH_SEGMENT);

    if (reportsSegmentIndex === -1) {
      return yield* E.fail(
        invalidValue(
          "URL must be a Fellowship Logs report link (…/reports/<code>).",
        ),
      );
    }

    const reportCode = pathSegments[reportsSegmentIndex + 1];

    if (reportCode === undefined) {
      return yield* E.fail(invalidValue("Missing report code in URL."));
    }

    const fightIdParam = url.searchParams.get(FIGHT_QUERY_PARAM);

    if (fightIdParam === null || fightIdParam.length === 0) {
      return yield* E.fail(
        invalidValue("URL is missing the `fight` query parameter."),
      );
    }

    const fightId = Number(fightIdParam);

    if (!Number.isInteger(fightId) || fightId < 1) {
      return yield* E.fail(
        invalidValue("The `fight` parameter must be a positive number."),
      );
    }

    return {
      fightId,
      reportCode,
    };
  });
}

export const FellowshipLogsReportUrlSchema = Schema.String.pipe(
  Schema.decodeTo(FellowshipLogsApiDungeonRunReferenceSchema, {
    decode: SchemaGetter.transformOrFail(parseReportUrl),
    encode: SchemaGetter.transform((reference) => {
      return `https://www.fellowshiplogs.com/${REPORTS_PATH_SEGMENT}/${reference.reportCode}?${FIGHT_QUERY_PARAM}=${reference.fightId}`;
    }),
  }),
);

import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type FellowshipLogsImportPageDAOShape } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { FellowshipLogsImportPageDAOError } from "@frt/db/errors/fellowship-logs-import-page-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { FellowshipLogsImportPageModel } from "@frt/db/models/fellowship-logs-import-page-model.ts";

function mapFellowshipLogsImportPageDAOError(
  cause: unknown,
): FellowshipLogsImportPageDAOError {
  if (cause instanceof FellowshipLogsImportPageDAOError) {
    return cause;
  }

  return new FellowshipLogsImportPageDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

export const makeFellowshipLogsImportPageDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const insert: FellowshipLogsImportPageDAOShape["insert"] = (options) => {
    return E.gen(function* () {
      const encoded = yield* Schema.encodeEffect(
        FellowshipLogsImportPageModel.insert,
      )(FellowshipLogsImportPageModel.insert.make(options));

      yield* sql`
        INSERT INTO
          fellowship_logs_import_page (
            background_job_id,
            page_index,
            next_page_timestamp,
            progress,
            report_revision,
            page,
            created_at
          )
        VALUES
          (
            ${encoded.backgroundJobId},
            ${encoded.pageIndex},
            ${encoded.nextPageTimestamp},
            ${encoded.progress},
            ${encoded.reportRevision},
            ${encoded.page},
            ${encoded.createdAt}
          )
        ON CONFLICT DO NOTHING
      `;
    }).pipe(E.mapError(mapFellowshipLogsImportPageDAOError));
  };

  const list: FellowshipLogsImportPageDAOShape["list"] = ({
    backgroundJobId,
  }) => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          background_job_id,
          page_index,
          next_page_timestamp,
          progress,
          report_revision,
          page,
          created_at
        FROM
          fellowship_logs_import_page
        WHERE
          background_job_id = ${backgroundJobId}
        ORDER BY
          page_index
      `;

      return yield* Schema.decodeUnknownEffect(
        Schema.Array(FellowshipLogsImportPageModel),
      )(rows);
    }).pipe(E.mapError(mapFellowshipLogsImportPageDAOError));
  };

  const deleteForJob: FellowshipLogsImportPageDAOShape["deleteForJob"] = ({
    backgroundJobId,
  }) => {
    return sql`
      DELETE FROM fellowship_logs_import_page
      WHERE
        background_job_id = ${backgroundJobId}
    `.pipe(E.asVoid, E.mapError(mapFellowshipLogsImportPageDAOError));
  };

  return {
    deleteForJob,
    insert,
    list,
  } satisfies FellowshipLogsImportPageDAOShape;
});

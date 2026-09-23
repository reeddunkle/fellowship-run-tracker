import * as E from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { FellowshipLogsDungeonRunImportReportChangedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { isConvertibleEvent } from "@frt/api/services/fellowship-logs/events/stream-fellowship-logs-events.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  type FellowshipLogsReport,
  FellowshipLogsReportSchema,
} from "@frt/api/services/fellowship-logs/validation/fellowship-logs-report-schema.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";
import { type FellowshipLogsImportPageModel } from "@frt/db/models/fellowship-logs-import-page-model.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

const FellowshipLogsReportFromJsonString = Schema.fromJsonString(
  FellowshipLogsReportSchema,
);

const decodeSavedPage = Schema.decodeUnknownResult(
  FellowshipLogsReportFromJsonString,
);

// Pages are saved with only the events the importer reads, which keeps them
// a fraction of their fetched size.
function toSavedPage(page: FellowshipLogsReport): FellowshipLogsReport {
  return {
    ...page,
    events: {
      ...page.events,
      data: page.events.data.filter(isConvertibleEvent),
    },
  };
}

type SavedPage = {
  readonly model: FellowshipLogsImportPageModel;
  readonly page: FellowshipLogsReport;
};

type StreamResumableReportPagesOptions = {
  /** The job the pages are saved under. */
  readonly backgroundJobId: BackgroundJobId;
  readonly fightId: FellowshipLogsFightId;
  readonly onProgress?: ((fraction: number) => E.Effect<void>) | undefined;
  readonly reportCode: FellowshipLogsReportCode;
};

/**
 * A job's saved pages. If any can't be read (e.g. saved by an older version),
 * they're all dropped and the import starts over.
 */
const loadSavedPages = E.fn("FellowshipLogsDungeonRunImporter.loadSavedPages")(
  function* (backgroundJobId: BackgroundJobId) {
    const importPageDAO = yield* FellowshipLogsImportPageDAO;

    const models = yield* importPageDAO.list({ backgroundJobId });

    const decoded = models.map((model) => {
      return Result.map(decodeSavedPage(model.page), (page): SavedPage => {
        return { model, page };
      });
    });

    if (decoded.every(Result.isSuccess)) {
      return decoded.map((result) => {
        return result.success;
      });
    }

    yield* E.logWarning(
      "Couldn't read the saved Fellowship Logs pages; starting the import over.",
    );
    yield* importPageDAO.deleteForJob({ backgroundJobId });

    return [];
  },
);

/**
 * A fight's report pages, saving each one as it's fetched. When the job has
 * pages saved from an earlier attempt, they're replayed first and fetching
 * carries on after the last of them, so no page is paid for twice.
 */
export const streamResumableReportPages = E.fn(
  "FellowshipLogsDungeonRunImporter.streamResumableReportPages",
)(function* ({
  backgroundJobId,
  fightId,
  onProgress,
  reportCode,
}: StreamResumableReportPagesOptions) {
  const fellowshipLogs = yield* FellowshipLogs;
  const importPageDAO = yield* FellowshipLogsImportPageDAO;

  const reportProgress = (fraction: number) => {
    return onProgress === undefined ? E.void : onProgress(fraction);
  };

  const savedPages = yield* loadSavedPages(backgroundJobId);
  const lastSavedPage = savedPages.at(-1);

  const replayed = Stream.fromIterable(savedPages).pipe(
    Stream.mapEffect(({ model, page }) => {
      return reportProgress(model.progress).pipe(E.as(page));
    }),
  );

  if (lastSavedPage?.model.nextPageTimestamp === null) {
    return replayed;
  }

  // The service reports progress just before emitting each page, so this
  // holds the fetched page's progress by the time it's saved.
  const progressRef = yield* Ref.make(0);

  const fetched = fellowshipLogs
    .streamReportPages({
      fightId,
      onProgress: (fraction) => {
        return Ref.set(progressRef, fraction).pipe(
          E.andThen(reportProgress(fraction)),
        );
      },
      reportCode,
      ...(lastSavedPage?.model.nextPageTimestamp === undefined
        ? {}
        : { startTime: lastSavedPage.model.nextPageTimestamp }),
    })
    .pipe(
      Stream.zipWithIndex,
      Stream.mapEffect(([page, index]) => {
        return E.gen(function* () {
          if (
            lastSavedPage !== undefined &&
            page.revision !== lastSavedPage.model.reportRevision
          ) {
            yield* importPageDAO.deleteForJob({ backgroundJobId });

            return yield* new FellowshipLogsDungeonRunImportReportChangedError({
              fightId,
              reportCode,
            });
          }

          const encodedPage = yield* Schema.encodeEffect(
            FellowshipLogsReportFromJsonString,
          )(toSavedPage(page)).pipe(E.orDie);

          yield* importPageDAO.insert({
            backgroundJobId,
            nextPageTimestamp: page.events.nextPageTimestamp,
            page: encodedPage,
            pageIndex: savedPages.length + index,
            progress: yield* Ref.get(progressRef),
            reportRevision: page.revision,
          });

          return page;
        });
      }),
    );

  return Stream.concat(replayed, fetched);
});

import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import { FellowshipLogsRateLimitExceededError } from "@frt/api/errors/fellowship-logs-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "@frt/api/services/fellowship-logs/fellowship-logs-fixture-paths.ts";
import {
  FellowshipLogs,
  type FellowshipLogsService,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { makeFellowshipLogsFixture } from "@frt/api/services/fellowship-logs/make-fellowship-logs-fixture.ts";

/**
 * Controls and records what the controlled fixture fetches. Tests change it
 * between calls.
 */
export type FellowshipLogsFetchControl = {
  /**
   * Run out of points instead of fetching more than this many pages in one
   * go. `undefined` fetches every page.
   */
  failAfterPages: number | undefined;
  /** How long after the failure the points reset. */
  failureResetDelayMilliseconds: number;
  /** Reported in place of each page's real revision. */
  overrideRevision: number | undefined;
  pagesFetched: number;
  /** The `startTime` each page stream was asked to start from. */
  startTimes: Array<number | undefined>;
};

export function makeFellowshipLogsFetchControl(): FellowshipLogsFetchControl {
  return {
    failAfterPages: undefined,
    failureResetDelayMilliseconds: 0,
    overrideRevision: undefined,
    pagesFetched: 0,
    startTimes: [],
  };
}

/**
 * The recorded-fixture Fellowship Logs service, with page fetching that a test
 * can count, cut short, or tamper with through `control`.
 */
export function makeControlledFellowshipLogsFixtureLayer(
  control: FellowshipLogsFetchControl,
) {
  return Layer.effect(
    FellowshipLogs,
    E.gen(function* () {
      const fixture = yield* makeFellowshipLogsFixture({
        fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
      });

      const runOutOfPoints = DateTime.now.pipe(
        E.flatMap((now) => {
          return E.fail(
            new FellowshipLogsRateLimitExceededError({
              reason: "RejectedByApi",
              resetsAt: DateTime.add(now, {
                milliseconds: control.failureResetDelayMilliseconds,
              }),
            }),
          );
        }),
      );

      const streamReportPages: FellowshipLogsService["streamReportPages"] = (
        options,
      ) => {
        control.startTimes.push(options.startTime);

        return fixture.streamReportPages(options).pipe(
          Stream.zipWithIndex,
          Stream.mapEffect(([page, index]) => {
            if (
              control.failAfterPages !== undefined &&
              index >= control.failAfterPages
            ) {
              return runOutOfPoints;
            }

            control.pagesFetched += 1;

            return E.succeed(
              control.overrideRevision === undefined
                ? page
                : { ...page, revision: control.overrideRevision },
            );
          }),
        );
      };

      return { ...fixture, streamReportPages } satisfies FellowshipLogsService;
    }),
  ).pipe(Layer.provide(NodePlatformLayer));
}

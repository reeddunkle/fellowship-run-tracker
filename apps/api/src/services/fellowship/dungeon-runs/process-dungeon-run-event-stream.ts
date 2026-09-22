import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type DuplicateMilestoneRequirementsError } from "@frt/api/errors/duplicate-milestone-requirements-error.ts";
import { compileConfiguration } from "@frt/api/services/fellowship/configurations/compile-configuration.ts";
import { createInitialDungeonRunProcessingState } from "@frt/api/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type ProcessDungeonRunEventResult,
  processDungeonRunEvent,
} from "@frt/api/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import {
  type CompiledConfiguration,
  type FellowshipMilestoneConfiguration,
} from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export type ProcessDungeonRunEventStreamResult =
  ProcessDungeonRunEventResult & {
    readonly configuration: CompiledConfiguration;
  };

type ProcessCompiledDungeonRunEventStreamOptions<Error> = {
  readonly configuration: CompiledConfiguration;
  readonly events: Stream.Stream<FellowshipEvent, Error>;
};

export type ProcessDungeonRunEventStreamOptions<Error> = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly events: Stream.Stream<FellowshipEvent, Error>;
};

function processCompiledDungeonRunEventStream<Error>({
  configuration,
  events,
}: ProcessCompiledDungeonRunEventStreamOptions<Error>): Stream.Stream<
  ProcessDungeonRunEventStreamResult,
  Error
> {
  return events.pipe(
    Stream.mapAccum(createInitialDungeonRunProcessingState, (state, event) => {
      const result = processDungeonRunEvent({
        configuration,
        event,
        state,
      });

      return [
        result.state,
        [
          {
            ...result,
            configuration,
          },
        ],
      ];
    }),
  );
}

export function processDungeonRunEventStream<Error>({
  configuration,
  events,
}: ProcessDungeonRunEventStreamOptions<Error>): Stream.Stream<
  ProcessDungeonRunEventStreamResult,
  Error | DuplicateMilestoneRequirementsError
> {
  return Stream.unwrap(
    compileConfiguration(configuration).pipe(
      E.map((compiledConfiguration) => {
        return processCompiledDungeonRunEventStream({
          configuration: compiledConfiguration,
          events,
        });
      }),
    ),
  );
}

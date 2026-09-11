import * as E from "effect/Effect";
import * as Stream from "effect/Stream";

import { type DuplicateMilestoneRequirementsError } from "@/errors/configuration-compilation-error.ts";
import { compileConfiguration } from "@/services/fellowship/configurations/compile-configuration.ts";
import {
  type CompiledConfiguration,
  type FellowshipMilestoneConfiguration,
} from "@/services/fellowship/configurations/configuration-types.ts";
import { createInitialDungeonRunState } from "@/services/fellowship/dungeon-runs/dungeon-run-processing-state.ts";
import {
  type ProcessDungeonRunEventResult,
  processDungeonRunEvent,
} from "@/services/fellowship/dungeon-runs/process-dungeon-run-event.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";

type ProcessDungeonRunEventStreamResult = ProcessDungeonRunEventResult & {
  readonly configuration: CompiledConfiguration;
};

export type ProcessDungeonRunEventStreamOptions<Error> = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly events: Stream.Stream<FellowshipEvent, Error>;
};

export function processDungeonRunEventStream<Error>({
  configuration,
  events,
}: ProcessDungeonRunEventStreamOptions<Error>): Stream.Stream<
  ProcessDungeonRunEventStreamResult,
  Error | DuplicateMilestoneRequirementsError
> {
  return Stream.unwrap(
    E.gen(function* () {
      const compiledConfiguration = yield* compileConfiguration(configuration);

      return events.pipe(
        Stream.mapAccum(createInitialDungeonRunState, (state, event) => {
          const result = processDungeonRunEvent({
            configuration: compiledConfiguration,
            event,
            state,
          });

          const streamResult = {
            ...result,
            configuration: compiledConfiguration,
          };

          return [result.state, [streamResult]];
        }),
      );
    }),
  );
}

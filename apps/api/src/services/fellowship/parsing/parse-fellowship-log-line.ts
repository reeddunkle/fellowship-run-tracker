import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { FellowshipEventInvalidError } from "@frt/api/errors/fellowship-event-error.ts";
import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import {
  type FellowshipEvent,
  fellowshipEventSchemas,
  isParsedFellowshipEventType,
} from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export const parseFellowshipLogLine: (
  line: string,
) => E.Effect<FellowshipEvent | undefined, FellowshipEventInvalidError> =
  E.fnUntraced(function* (line) {
    const fields = line.split("|");
    const eventType = getEventType(fields);

    if (!isParsedFellowshipEventType(eventType)) {
      return undefined;
    }

    return yield* Schema.decodeUnknownEffect(fellowshipEventSchemas[eventType])(
      fields,
    ).pipe(
      E.mapError((cause) => {
        return new FellowshipEventInvalidError({
          cause,
          line,
        });
      }),
    );
  });

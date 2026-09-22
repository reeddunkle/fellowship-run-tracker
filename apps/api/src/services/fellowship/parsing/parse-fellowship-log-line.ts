import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  FellowshipEventInvalidError,
  FellowshipEventUnsupportedTypeError,
} from "@frt/api/errors/fellowship-event-error.ts";
import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import {
  fellowshipEventSchemas,
  isParsedFellowshipEventType,
} from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export const parseFellowshipLogLine = E.fn("fellowship.parse-log-line")(
  function* (line: string) {
    const eventType = getEventType(line);

    if (!isParsedFellowshipEventType(eventType)) {
      return yield* new FellowshipEventUnsupportedTypeError({
        eventType,
        line,
      });
    }

    const schema = fellowshipEventSchemas[eventType];

    return yield* Schema.decodeUnknownEffect(schema)(line.split("|")).pipe(
      E.mapError((cause) => {
        return new FellowshipEventInvalidError({
          cause,
          line,
        });
      }),
    );
  },
);

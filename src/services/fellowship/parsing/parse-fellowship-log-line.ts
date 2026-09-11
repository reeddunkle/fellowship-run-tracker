import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  FellowshipInvalidEventError,
  FellowshipUnsupportedEventTypeError,
} from "@/errors/fellowship-log-parse-error.ts";
import { getEventType } from "@/services/fellowship/parsing/get-event-type.ts";
import {
  fellowshipEventSchemas,
  isParsedFellowshipEventType,
} from "@/services/fellowship/validation/fellowship-event-schema.ts";

export const parseFellowshipLogLine = E.fn("fellowship.parse-log-line")(
  function* (line: string) {
    const eventType = getEventType(line);

    if (!isParsedFellowshipEventType(eventType)) {
      return yield* new FellowshipUnsupportedEventTypeError({
        eventType,
        line,
      });
    }

    const schema = fellowshipEventSchemas[eventType];

    return yield* Schema.decodeUnknownEffect(schema)(line.split("|")).pipe(
      E.mapError((cause) => {
        return new FellowshipInvalidEventError({
          cause,
          line,
        });
      }),
    );
  },
);

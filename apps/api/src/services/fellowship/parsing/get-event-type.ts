import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { FellowshipLogHeaderSchema } from "@frt/api/services/fellowship/validation/fellowship-header-schema.ts";
import { type FellowshipEventType } from "@frt/shared/fellowship/constants/fellowship-event.ts";

const decodeFellowshipLogHeader = Schema.decodeUnknownOption(
  FellowshipLogHeaderSchema,
);

export function getEventType(line: string): FellowshipEventType | undefined {
  return decodeFellowshipLogHeader(line.split("|")).pipe(
    Option.map(([, eventType]) => eventType),
    Option.getOrUndefined,
  );
}

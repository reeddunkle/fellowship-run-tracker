import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipEventType } from "@/services/fellowship/constants/fellowship-event.ts";
import { FellowshipLogHeaderSchema } from "@/services/fellowship/validation/fellowship-header-schema.ts";

const decodeFellowshipLogHeader = Schema.decodeUnknownOption(
  FellowshipLogHeaderSchema,
);

export function getEventType(line: string): FellowshipEventType | undefined {
  return decodeFellowshipLogHeader(line.split("|")).pipe(
    Option.map(([, eventType]) => eventType),
    Option.getOrUndefined,
  );
}

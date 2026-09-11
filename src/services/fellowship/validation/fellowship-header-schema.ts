import * as Schema from "effect/Schema";

import { fellowshipEventTypes } from "@/services/fellowship/constants/fellowship-event.ts";

const FellowshipEventTypeSchema = Schema.Literals(fellowshipEventTypes);

export const FellowshipLogHeaderSchema = Schema.TupleWithRest(
  Schema.Tuple([Schema.String, FellowshipEventTypeSchema]),
  [Schema.String],
);

import * as DateTime from "effect/DateTime";

export const SESSION_STARTED_AT = DateTime.makeUnsafe(performance.timeOrigin);

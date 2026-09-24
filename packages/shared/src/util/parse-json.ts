import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { UnknownFromJsonStringSchema } from "@frt/shared/util/common-schemas.ts";

export type ParseJsonOptions<Error> = {
  readonly contents: string;
  readonly onError: (cause: unknown) => Error;
};

export function parseJson<Error>({
  contents,
  onError,
}: ParseJsonOptions<Error>): E.Effect<unknown, Error> {
  return Schema.decodeEffect(UnknownFromJsonStringSchema)(contents).pipe(
    E.mapError(onError),
  );
}

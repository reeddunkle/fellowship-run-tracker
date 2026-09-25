import * as E from "effect/Effect";

import { type RouterContext } from "@/renderer/router/router-context.ts";
import { FellowshipCatalogData } from "@/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service.ts";

export function loadFellowshipCatalogData({
  browserRuntime,
}: Pick<RouterContext, "browserRuntime">) {
  return browserRuntime.runPromise(
    E.gen(function* () {
      const fellowshipCatalogData = yield* FellowshipCatalogData;

      return yield* fellowshipCatalogData.get;
    }),
  );
}

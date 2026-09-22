import * as E from "effect/Effect";

import { type RouterContext } from "@/renderer/router/router-context.ts";
import { FellowshipCatalogDataService } from "@/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service.ts";

export function loadFellowshipCatalogData({
  browserRuntime,
}: Pick<RouterContext, "browserRuntime">) {
  return browserRuntime.runPromise(
    E.gen(function* () {
      const fellowshipCatalogDataService = yield* FellowshipCatalogDataService;

      return yield* fellowshipCatalogDataService.get;
    }),
  );
}

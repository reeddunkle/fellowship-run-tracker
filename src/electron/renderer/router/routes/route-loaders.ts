import * as E from "effect/Effect";

import { type RouterContext } from "@/electron/renderer/router/router-context.ts";
import { FellowshipCatalogDataService } from "@/electron/renderer/services/fellowship-catalog-data/fellowship-catalog-data-service.ts";

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

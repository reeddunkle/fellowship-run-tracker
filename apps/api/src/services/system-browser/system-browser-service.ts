import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Redacted from "effect/Redacted";

import { SystemBrowserError } from "@frt/api/errors/system-browser-error.ts";

export type SystemBrowserShape = {
  readonly open: (
    url: Redacted.Redacted<string>,
  ) => E.Effect<void, SystemBrowserError>;
};

export class SystemBrowser extends Context.Service<
  SystemBrowser,
  SystemBrowserShape
>()("@frt/api/services/system-browser/system-browser-service/SystemBrowser") {
  static readonly unavailableLayer = Layer.succeed(this, {
    open: () => E.fail(new SystemBrowserError({ reason: "Unavailable" })),
  });
}

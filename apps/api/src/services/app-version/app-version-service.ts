import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

export class AppVersion extends Context.Service<AppVersion, string>()(
  "@frt/api/services/app-version/app-version-service/AppVersion",
) {
  static readonly layerWith = (appVersion: string) => {
    return Layer.succeed(this)(appVersion);
  };
}

import * as Schema from "effect/Schema";

import { APP_CONFIG_DEFAULTS } from "@frt/shared/app-config/app-config-defaults.ts";
import {
  type ElectronRendererHost,
  ElectronRendererHostSchema,
  type ElectronRendererPort,
  ElectronRendererPortSchema,
} from "@frt/shared/electron-renderer/electron-renderer-env-schema.ts";

const RendererEnvSchema = Schema.Struct({
  ELECTRON_RENDERER_HOST: ElectronRendererHostSchema,
  ELECTRON_RENDERER_PORT: ElectronRendererPortSchema,
});

export type RendererEnv = {
  readonly host: ElectronRendererHost;
  readonly port: ElectronRendererPort;
};

export function parseRendererEnv(
  source: Readonly<Record<string, string>>,
): RendererEnv {
  const rawEnv = Schema.decodeSync(RendererEnvSchema)({
    ELECTRON_RENDERER_HOST: APP_CONFIG_DEFAULTS.ELECTRON_RENDERER_HOST,
    ELECTRON_RENDERER_PORT: String(APP_CONFIG_DEFAULTS.ELECTRON_RENDERER_PORT),
    ...source,
  });

  return {
    host: rawEnv.ELECTRON_RENDERER_HOST,
    port: rawEnv.ELECTRON_RENDERER_PORT,
  };
}

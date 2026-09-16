import * as Schema from "effect/Schema";

import {
  type ElectronRendererHost,
  type ElectronRendererPort,
  RawEnvSchema,
} from "./validation/env-schema.ts";

export type Env = {
  readonly electronRenderer: {
    readonly host: ElectronRendererHost;
    readonly port: ElectronRendererPort;
  };
};

export function parseEnv(source: unknown): Env {
  // @effect-diagnostics-next-line schemaSync:off
  const rawEnv = Schema.decodeUnknownSync(RawEnvSchema)(source);

  return {
    electronRenderer: {
      host: rawEnv.ELECTRON_RENDERER_HOST,
      port: rawEnv.ELECTRON_RENDERER_PORT,
    },
  };
}

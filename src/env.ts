import "dotenv/config";

import * as Schema from "effect/Schema";

import { RawEnvSchema } from "./validation/env-schema.ts";

export type Env = {
  readonly databaseFilename: string;
  readonly electronRenderer: {
    readonly host: string;
    readonly port: number;
  };
};

export function parseEnv(source: unknown): Env {
  const rawEnv = Schema.decodeUnknownSync(RawEnvSchema)(source);

  return {
    databaseFilename: rawEnv.DATABASE_FILENAME,
    electronRenderer: {
      host: rawEnv.ELECTRON_RENDERER_HOST,
      port: rawEnv.ELECTRON_RENDERER_PORT,
    },
  };
}

export const env = parseEnv(process.env);

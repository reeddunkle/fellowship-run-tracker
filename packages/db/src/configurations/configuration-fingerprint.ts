import * as E from "effect/Effect";

import { Sha256Error } from "@frt/db/errors/sha256-error.ts";
import { type ConfigurationDefinitionFingerprint } from "@frt/db/validation/configuration/configuration-definition-fingerprint-schema.ts";
import {
  serializeCanonicalConfiguration,
  serializeCanonicalConfigurationDefinition,
} from "@frt/shared/configuration/canonicalize-configuration.ts";
import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";
import { type ConfigurationFingerprint } from "@frt/shared/validation/configuration/configuration-fingerprint-schema.ts";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

function sha256(value: string): E.Effect<string, Sha256Error> {
  return E.tryPromise({
    catch: (cause) => {
      return new Sha256Error({
        cause,
      });
    },
    try: () => {
      const bytes = new TextEncoder().encode(value);

      return globalThis.crypto.subtle
        .digest("SHA-256", bytes)
        .then((digest) => {
          return bytesToHex(new Uint8Array(digest));
        });
    },
  });
}

export function createConfigurationDefinitionFingerprint(
  configuration: FellowshipMilestoneConfiguration,
) {
  const canonicalJson =
    serializeCanonicalConfigurationDefinition(configuration);

  return E.gen(function* () {
    const fingerprint = (yield* sha256(
      canonicalJson,
    )) as ConfigurationDefinitionFingerprint;

    return {
      canonicalJson,
      fingerprint,
    };
  });
}

export function createConfigurationFingerprint(
  configuration: FellowshipMilestoneConfiguration,
) {
  const canonicalJson = serializeCanonicalConfiguration(configuration);

  return E.gen(function* () {
    const fingerprint = (yield* sha256(
      canonicalJson,
    )) as ConfigurationFingerprint;

    return {
      canonicalJson,
      fingerprint,
    };
  });
}

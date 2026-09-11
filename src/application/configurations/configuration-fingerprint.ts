import * as E from "effect/Effect";

import { Sha256Error } from "@/errors/crypto-error.ts";
import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { type ConfigurationDefinitionFingerprint } from "@/validation/configuration/configuration-definition-fingerprint-schema.ts";
import { type ConfigurationFingerprint } from "@/validation/configuration/configuration-fingerprint-schema.ts";

import {
  serializeCanonicalConfiguration,
  serializeCanonicalConfigurationDefinition,
} from "./canonicalize-configuration.ts";

export type ConfigurationDefinitionFingerprintResult = {
  readonly canonicalJson: string;
  readonly fingerprint: ConfigurationDefinitionFingerprint;
};

export type ConfigurationFingerprintResult = {
  readonly canonicalJson: string;
  readonly fingerprint: ConfigurationFingerprint;
};

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

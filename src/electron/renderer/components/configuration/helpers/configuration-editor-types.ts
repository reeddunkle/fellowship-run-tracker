import { type ConfigurationFingerprint } from "@/validation/configuration/configuration-fingerprint-schema.ts";

export type ConfigurationOption = {
  readonly fingerprint: ConfigurationFingerprint;
  readonly label: string;
};

export type DungeonOption = {
  readonly key: string;
  readonly label: string;
};

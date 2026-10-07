// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { type LiveTrackingScenario } from "@frt/api/tests/e2e/live-tracking/live-tracking-test-harness.ts";

import { configuration, label } from "./configuration.ts";

export const godfallQuarry64TimedScenario = {
  configuration,
  label,
  logFilePath: path.join(import.meta.dirname, "log.txt"),
} satisfies LiveTrackingScenario;

import { NodeServices } from "@effect/platform-node";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as E from "effect/Effect";
import * as Command from "effect/unstable/cli/Command";

import { captureFellowshipLogsReportCommand } from "@frt/cli/commands/capture-fellowship-logs-report-command.ts";
import { filterLogCommand } from "@frt/cli/commands/filter-log-command.ts";
import { generateLSSCommand } from "@frt/cli/commands/generate-lss-command.ts";
import { generateUnitCatalogCommand } from "@frt/cli/commands/generate-unit-catalog-command.ts";
import { replayLogCommand } from "@frt/cli/commands/replay-log-command.ts";
import { serveCommand } from "@frt/cli/commands/serve-command.ts";
import { setupDatabaseCommand } from "@frt/cli/commands/setup-database-command.ts";
import { splitLogCommand } from "@frt/cli/commands/split-log-command.ts";

import packageJson from "../package.json" with { type: "json" };

const cli = Command.make("fellowship-run-tracker").pipe(
  Command.withDescription("Developer tools for Fellowship Run Tracker."),
  Command.withSubcommands([
    captureFellowshipLogsReportCommand,
    filterLogCommand,
    generateLSSCommand,
    generateUnitCatalogCommand,
    replayLogCommand,
    serveCommand,
    setupDatabaseCommand,
    splitLogCommand,
  ]),
);

Command.run(cli, {
  version: packageJson.version,
}).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodeServices.layer),
  NodeRuntime.runMain,
);

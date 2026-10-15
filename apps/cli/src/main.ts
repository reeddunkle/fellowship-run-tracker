import { NodeServices } from "@effect/platform-node";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Command from "effect/cli/Command";
import * as E from "effect/Effect";

import { enableFellowshipEventSchemaJit } from "@frt/api/services/fellowship/parsing/enable-fellowship-event-schema-jit.ts";
import { benchParseCommand } from "@frt/cli/commands/bench-parse-command.ts";
import { captureFellowshipLogsReportCommand } from "@frt/cli/commands/capture-fellowship-logs-report-command.ts";
import { filterLogCommand } from "@frt/cli/commands/filter-log-command.ts";
import { generateLSSCommand } from "@frt/cli/commands/generate-lss-command.ts";
import { generateUnitCatalogCommand } from "@frt/cli/commands/generate-unit-catalog-command.ts";
import { replayLogCommand } from "@frt/cli/commands/replay-log-command.ts";
import { serveCommand } from "@frt/cli/commands/serve-command.ts";
import { setupDatabaseCommand } from "@frt/cli/commands/setup-database-command.ts";
import { splitLogCommand } from "@frt/cli/commands/split-log-command.ts";
import { validateFellowshipLogsEventCostsCommand } from "@frt/cli/commands/validate-fellowship-logs-event-costs-command.ts";

import packageJson from "../package.json" with { type: "json" };

enableFellowshipEventSchemaJit();

const cli = Command.make("fellowship-run-tracker").pipe(
  Command.withDescription("Developer tools for Fellowship Run Tracker."),
  Command.withSubcommands([
    benchParseCommand,
    captureFellowshipLogsReportCommand,
    filterLogCommand,
    generateLSSCommand,
    generateUnitCatalogCommand,
    replayLogCommand,
    serveCommand,
    setupDatabaseCommand,
    splitLogCommand,
    validateFellowshipLogsEventCostsCommand,
  ]),
);

Command.run(cli, {
  version: packageJson.version,
}).pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodeServices.layer),
  NodeRuntime.runMain,
);

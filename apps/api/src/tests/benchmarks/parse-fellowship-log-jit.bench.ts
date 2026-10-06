import { enableFellowshipEventSchemaJit } from "@frt/api/services/fellowship/parsing/enable-fellowship-event-schema-jit.ts";
import { describeParseFellowshipLogBenchmarks } from "@frt/api/tests/common/parse-fellowship-log-benchmarks.ts";

enableFellowshipEventSchemaJit();

describeParseFellowshipLogBenchmarks(
  "Everdawn Grove fixture with JIT-compiled schemas",
);

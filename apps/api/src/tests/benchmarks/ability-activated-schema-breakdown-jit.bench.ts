import "effect/schema/SchemaJITCompiler/enable";

import { describeAbilityActivatedSchemaBreakdownBenchmarks } from "@frt/api/tests/common/ability-activated-schema-breakdown-benchmarks.ts";

describeAbilityActivatedSchemaBreakdownBenchmarks(
  "ABILITY_ACTIVATED breakdown with JIT-compiled schemas",
);

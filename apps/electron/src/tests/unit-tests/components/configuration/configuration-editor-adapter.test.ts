import * as Schema from "effect/Schema";
import { expect, test } from "vitest";

import { ConfigurationLabelSchema } from "@frt/shared/configuration/configuration-label-schema.ts";

import { saveConfigurationApiRequest } from "@/renderer/components/configuration/form/configuration-editor-adapter.ts";

test("normalizes Adventure configurations to the fixed Adventure level", () => {
  const request = saveConfigurationApiRequest({
    adventureDifficulty: "HARD",
    dungeonCategory: "ADVENTURE",
    dungeonId: "36",
    dungeonLevel: 99,
    label: Schema.decodeSync(ConfigurationLabelSchema)("Adventure Hard"),
    milestones: [],
  });

  expect(request.configuration.dungeonLevel).toBe(1);
});

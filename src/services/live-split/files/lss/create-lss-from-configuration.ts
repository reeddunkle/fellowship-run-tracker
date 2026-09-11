import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";
import { type FellowshipMilestoneDefinition } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";

import { createXMLElement, renderXMLDocument, type XMLElement } from "./xml.ts";

export type CreateLSSFromConfigurationOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonName: string;
};

function createGameName(dungeonName: string): string {
  return `Fellowship ${dungeonName}`;
}

function createSegment(milestone: FellowshipMilestoneDefinition): XMLElement {
  return createXMLElement({
    children: [
      createXMLElement({
        children: [milestone.label],
        name: "Name",
      }),
      createXMLElement({
        name: "Icon",
      }),
      createXMLElement({
        name: "SplitTimes",
      }),
      createXMLElement({
        name: "BestSegmentTime",
      }),
      createXMLElement({
        name: "SegmentHistory",
      }),
    ],
    name: "Segment",
  });
}

function createLSSXMLTree(
  configuration: FellowshipMilestoneConfiguration,
  dungeonName: string,
): XMLElement {
  return createXMLElement({
    attributes: {
      version: "1.7.0",
    },
    children: [
      createXMLElement({
        name: "GameIcon",
      }),
      createXMLElement({
        children: [createGameName(dungeonName)],
        name: "GameName",
      }),
      createXMLElement({
        name: "CategoryName",
      }),
      createXMLElement({
        name: "LayoutPath",
      }),
      createXMLElement({
        children: [
          createXMLElement({
            attributes: {
              id: "",
            },
            name: "Run",
          }),
          createXMLElement({
            attributes: {
              usesEmulator: "False",
            },
            name: "Platform",
          }),
          createXMLElement({
            name: "Region",
          }),
          createXMLElement({
            name: "Variables",
          }),
          createXMLElement({
            name: "CustomVariables",
          }),
        ],
        name: "Metadata",
      }),
      createXMLElement({
        children: ["00:00:00"],
        name: "Offset",
      }),
      createXMLElement({
        children: ["0"],
        name: "AttemptCount",
      }),
      createXMLElement({
        children: configuration.milestones.map(createSegment),
        name: "Segments",
      }),
      createXMLElement({
        name: "AutoSplitterSettings",
      }),
    ],
    name: "Run",
  });
}

export function createLSSFromConfiguration({
  configuration,
  dungeonName,
}: CreateLSSFromConfigurationOptions): string {
  return renderXMLDocument(createLSSXMLTree(configuration, dungeonName));
}

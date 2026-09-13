import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Schema from "effect/Schema";

import {
  type ServiceBundleAnalysis,
  ServiceBundleAnalysisSchema,
  type ServiceBundleRelationship,
  type ServiceBundleRequirementReduction,
  type ServiceBundleServiceMembership,
} from "./service-bundle-analysis.ts";

const encodeBundleAnalysis = Schema.encodeSync(
  Schema.fromJsonString(ServiceBundleAnalysisSchema),
);

function getMermaidNodeId(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9_]/g, "_");
}

function renderBundleNode(name: string): string {
  return `  ${getMermaidNodeId(name)}["${name}"]`;
}

function renderServiceNode(service: string): string {
  return `  ${getMermaidNodeId(service)}["${service}"]`;
}

function renderServiceMembershipEdges({
  bundles,
  service,
}: ServiceBundleServiceMembership): ReadonlyArray<string> {
  const serviceNodeId = getMermaidNodeId(service);

  return pipe(
    bundles,
    A.map((bundle) => {
      return `  ${getMermaidNodeId(bundle)} -.-> ${serviceNodeId}`;
    }),
  );
}

function renderBundleRelationshipEdge(
  bundleRelationship: ServiceBundleRelationship,
): string {
  const bundleNodeId = getMermaidNodeId(bundleRelationship.bundle);
  const comparedBundleNodeId = getMermaidNodeId(
    bundleRelationship.comparedBundle,
  );
  const sharedServiceCount = bundleRelationship.sharedServices.length;

  if (bundleRelationship.relationship === "strict-subset") {
    return `  ${bundleNodeId} -->|"strict subset · ${sharedServiceCount} shared"| ${comparedBundleNodeId}`;
  }

  if (bundleRelationship.relationship === "strict-superset") {
    return `  ${comparedBundleNodeId} -->|"strict subset · ${sharedServiceCount} shared"| ${bundleNodeId}`;
  }

  if (bundleRelationship.relationship === "closed-by") {
    return `  ${bundleNodeId} -->|"closed by · ${sharedServiceCount} services"| ${comparedBundleNodeId}`;
  }

  if (bundleRelationship.relationship === "closes") {
    return `  ${comparedBundleNodeId} -->|"closed by · ${sharedServiceCount} services"| ${bundleNodeId}`;
  }

  if (bundleRelationship.relationship === "equal") {
    return `  ${bundleNodeId} ---|"equal · ${sharedServiceCount} services"| ${comparedBundleNodeId}`;
  }

  return `  ${bundleNodeId} -.-|"overlap · ${sharedServiceCount} shared"| ${comparedBundleNodeId}`;
}

function renderRequirementReductionEdge(
  requirementReduction: ServiceBundleRequirementReduction,
): string {
  const bundleNodeId = getMermaidNodeId(requirementReduction.bundle);
  const reducedByBundleNodeId = getMermaidNodeId(
    requirementReduction.reducedByBundle,
  );
  const removedRequirementCount =
    requirementReduction.removedRequirements.length;

  if (requirementReduction.relationship === "closes") {
    return `  ${bundleNodeId} -->|"closes · ${removedRequirementCount} requirements"| ${reducedByBundleNodeId}`;
  }

  const remainingRequirementCount =
    requirementReduction.remainingRequirements.length;

  return `  ${bundleNodeId} -->|"reduces · ${removedRequirementCount} removed · ${remainingRequirementCount} remain"| ${reducedByBundleNodeId}`;
}

export function renderServiceBundleAnalysisJson(
  analysis: ServiceBundleAnalysis,
): string {
  return `${encodeBundleAnalysis(analysis)}\n`;
}

export function renderServiceBundleMembershipsMermaid(
  analysis: ServiceBundleAnalysis,
): string {
  const repeatedServiceMemberships = analysis.serviceMemberships;

  const bundleNames = pipe(
    repeatedServiceMemberships,
    A.flatMap((membership) => membership.bundles),
    A.dedupe,
  );

  const bundleNodes = pipe(bundleNames, A.map(renderBundleNode));

  const serviceNodes = pipe(
    repeatedServiceMemberships,
    A.map((membership) => renderServiceNode(membership.service)),
  );

  const edges = pipe(
    repeatedServiceMemberships,
    A.flatMap(renderServiceMembershipEdges),
  );

  return pipe(
    ["flowchart LR", ...bundleNodes, ...serviceNodes, ...edges],
    (lines) => `${lines.join("\n")}\n`,
  );
}

export function renderServiceBundleRelationshipsMermaid(
  analysis: ServiceBundleAnalysis,
): string {
  const bundleNames = pipe(
    analysis.bundleRelationships,
    A.flatMap((bundleRelationship) => {
      return [bundleRelationship.bundle, bundleRelationship.comparedBundle];
    }),
    A.dedupe,
  );

  const bundleNodes = pipe(bundleNames, A.map(renderBundleNode));

  const edges = pipe(
    analysis.bundleRelationships,
    A.map(renderBundleRelationshipEdge),
  );

  return pipe(
    ["flowchart LR", ...bundleNodes, ...edges],
    (lines) => `${lines.join("\n")}\n`,
  );
}

export function renderServiceBundleRequirementReductionsMermaid(
  analysis: ServiceBundleAnalysis,
): string {
  const bundleNames = pipe(
    analysis.requirementReductions,
    A.flatMap((requirementReduction) => {
      return [
        requirementReduction.bundle,
        requirementReduction.reducedByBundle,
      ];
    }),
    A.dedupe,
  );

  const bundleNodes = pipe(bundleNames, A.map(renderBundleNode));

  const edges = pipe(
    analysis.requirementReductions,
    A.map(renderRequirementReductionEdge),
  );

  return pipe(
    ["flowchart LR", ...bundleNodes, ...edges],
    (lines) => `${lines.join("\n")}\n`,
  );
}

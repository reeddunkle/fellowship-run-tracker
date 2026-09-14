import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";

import {
  type LayerAnalysisModel,
  type LayerAnalysisNode,
} from "./layer-analysis-model.ts";

const ServiceBundleSchema = Schema.Struct({
  name: Schema.String,
  requires: Schema.Array(Schema.String),
  services: Schema.Array(Schema.String),
});

type ServiceBundle = typeof ServiceBundleSchema.Type;

const ServiceBundleRelationshipSchema = Schema.Struct({
  bundle: Schema.String,
  comparedBundle: Schema.String,
  onlyInBundle: Schema.Array(Schema.String),
  onlyInComparedBundle: Schema.Array(Schema.String),
  relationship: Schema.Union([
    Schema.Literal("closed-by"),
    Schema.Literal("closes"),
    Schema.Literal("equal"),
    Schema.Literal("strict-superset"),
    Schema.Literal("strict-subset"),
    Schema.Literal("overlap"),
  ]),
  sharedServices: Schema.Array(Schema.String),
});

export type ServiceBundleRelationship =
  typeof ServiceBundleRelationshipSchema.Type;

const ServiceBundleRequirementReductionSchema = Schema.Struct({
  bundle: Schema.String,
  reducedByBundle: Schema.String,
  relationship: Schema.Union([
    Schema.Literal("closes"),
    Schema.Literal("reduces"),
  ]),
  remainingRequirements: Schema.Array(Schema.String),
  removedRequirements: Schema.Array(Schema.String),
  services: Schema.Array(Schema.String),
});

export type ServiceBundleRequirementReduction =
  typeof ServiceBundleRequirementReductionSchema.Type;

const ServiceBundleServiceMembershipSchema = Schema.Struct({
  bundles: Schema.Array(Schema.String),
  service: Schema.String,
});

export type ServiceBundleServiceMembership =
  typeof ServiceBundleServiceMembershipSchema.Type;

export const ServiceBundleAnalysisSchema = Schema.Struct({
  bundleRelationships: Schema.Array(ServiceBundleRelationshipSchema),
  bundles: Schema.Array(ServiceBundleSchema),
  requirementReductions: Schema.Array(ServiceBundleRequirementReductionSchema),
  serviceMemberships: Schema.Array(ServiceBundleServiceMembershipSchema),
});

export type ServiceBundleAnalysis = typeof ServiceBundleAnalysisSchema.Type;

function isServiceBundle(layer: LayerAnalysisNode): boolean {
  return layer.composedFrom.length > 0;
}

function getEqualServiceRelationship(
  bundle: ServiceBundle,
  comparedBundle: ServiceBundle,
): ServiceBundleRelationship["relationship"] {
  const bundleIsClosed = bundle.requires.length === 0;
  const comparedBundleIsClosed = comparedBundle.requires.length === 0;

  if (!bundleIsClosed && comparedBundleIsClosed) {
    return "closed-by";
  }

  if (bundleIsClosed && !comparedBundleIsClosed) {
    return "closes";
  }

  return "equal";
}

function analyzeBundleRelationship(
  bundle: ServiceBundle,
  comparedBundle: ServiceBundle,
): ServiceBundleRelationship | undefined {
  const sharedServices = pipe(
    bundle.services,
    A.filter((service) => comparedBundle.services.includes(service)),
  );

  if (sharedServices.length === 0) {
    return undefined;
  }

  const onlyInBundle = pipe(
    bundle.services,
    A.filter((service) => !comparedBundle.services.includes(service)),
  );

  const onlyInComparedBundle = pipe(
    comparedBundle.services,
    A.filter((service) => !bundle.services.includes(service)),
  );

  const relationship: ServiceBundleRelationship["relationship"] =
    onlyInBundle.length === 0 && onlyInComparedBundle.length === 0
      ? getEqualServiceRelationship(bundle, comparedBundle)
      : onlyInBundle.length > 0 && onlyInComparedBundle.length === 0
        ? "strict-superset"
        : onlyInBundle.length === 0 && onlyInComparedBundle.length > 0
          ? "strict-subset"
          : "overlap";

  return {
    bundle: bundle.name,
    comparedBundle: comparedBundle.name,
    onlyInBundle,
    onlyInComparedBundle,
    relationship,
    sharedServices,
  };
}

function analyzeRequirementReduction(
  bundle: ServiceBundle,
  comparedBundle: ServiceBundle,
): ServiceBundleRequirementReduction | undefined {
  const hasEqualServices =
    bundle.services.length === comparedBundle.services.length &&
    bundle.services.every((service) => {
      return comparedBundle.services.includes(service);
    });

  if (!hasEqualServices) {
    return undefined;
  }

  const addedRequirements = pipe(
    comparedBundle.requires,
    A.filter((requirement) => !bundle.requires.includes(requirement)),
  );

  if (addedRequirements.length > 0) {
    return undefined;
  }

  const removedRequirements = pipe(
    bundle.requires,
    A.filter((requirement) => !comparedBundle.requires.includes(requirement)),
  );

  if (removedRequirements.length === 0) {
    return undefined;
  }

  return {
    bundle: bundle.name,
    reducedByBundle: comparedBundle.name,
    relationship: comparedBundle.requires.length === 0 ? "closes" : "reduces",
    remainingRequirements: comparedBundle.requires,
    removedRequirements,
    services: bundle.services,
  };
}

export function analyzeServiceBundles(
  model: LayerAnalysisModel,
): ServiceBundleAnalysis {
  const bundles = pipe(
    model.layers,
    A.filter(isServiceBundle),
    A.map((layer) => {
      return {
        name: layer.name,
        requires: layer.requires,
        services: layer.provides,
      };
    }),
  );

  const services = pipe(
    bundles,
    A.flatMap((bundle) => bundle.services),
    A.dedupe,
  );

  const serviceMemberships = pipe(
    services,
    A.map((service) => {
      return {
        bundles: pipe(
          bundles,
          A.filter((bundle) => bundle.services.includes(service)),
          A.map((bundle) => bundle.name),
        ),
        service,
      };
    }),
    A.filter((membership) => membership.bundles.length > 1),
  );

  const bundleRelationships = pipe(
    bundles,
    A.flatMap((bundle, bundleIndex) => {
      return pipe(
        bundles,
        A.drop(bundleIndex + 1),
        A.map((comparedBundle) => {
          return analyzeBundleRelationship(bundle, comparedBundle);
        }),
        A.filter(Predicate.isNotUndefined),
      );
    }),
  );

  const requirementReductions = pipe(
    bundles,
    A.flatMap((bundle) => {
      return pipe(
        bundles,
        A.filter((comparedBundle) => comparedBundle.name !== bundle.name),
        A.map((comparedBundle) => {
          return analyzeRequirementReduction(bundle, comparedBundle);
        }),
        A.filter(Predicate.isNotUndefined),
      );
    }),
  );

  return {
    bundleRelationships,
    bundles,
    requirementReductions,
    serviceMemberships,
  };
}

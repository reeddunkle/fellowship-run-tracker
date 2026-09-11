import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Predicate from "effect/Predicate";

import {
  type LayerAnalysisModel,
  type LayerAnalysisNode,
} from "./layer-analysis-model.ts";

export type ServiceBundle = {
  readonly name: string;
  readonly requires: ReadonlyArray<string>;
  readonly services: ReadonlyArray<string>;
};

export type ServiceBundleRelationship = {
  readonly bundle: string;
  readonly comparedBundle: string;
  readonly sharedServices: ReadonlyArray<string>;
  readonly onlyInBundle: ReadonlyArray<string>;
  readonly onlyInComparedBundle: ReadonlyArray<string>;
  readonly relationship:
    | "closed-by"
    | "closes"
    | "equal"
    | "strict-superset"
    | "strict-subset"
    | "overlap";
};

export type ServiceBundleRequirementReduction = {
  readonly bundle: string;
  readonly reducedByBundle: string;
  readonly removedRequirements: ReadonlyArray<string>;
  readonly remainingRequirements: ReadonlyArray<string>;
  readonly relationship: "closes" | "reduces";
  readonly services: ReadonlyArray<string>;
};

export type ServiceBundleServiceMembership = {
  readonly bundles: ReadonlyArray<string>;
  readonly service: string;
};

export type ServiceBundleAnalysis = {
  readonly bundles: ReadonlyArray<ServiceBundle>;
  readonly bundleRelationships: ReadonlyArray<ServiceBundleRelationship>;
  readonly requirementReductions: ReadonlyArray<ServiceBundleRequirementReduction>;
  readonly serviceMemberships: ReadonlyArray<ServiceBundleServiceMembership>;
};

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

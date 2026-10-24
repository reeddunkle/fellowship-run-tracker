import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";

import { type FellowshipLogsRequestCost } from "@frt/shared/fellowship-logs/get-fellowship-logs-request-cost.ts";

export type FellowshipLogsGatewayWorkflowCost = {
  readonly apiRequestCount: number;
  readonly applicationPoints: number;
  readonly cacheHitCount: number;
  readonly estimatedPoints: number;
  readonly totalPoints: number;
  readonly unmeasuredRequestCount: number;
  readonly userPoints: number;
};

export const EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST: FellowshipLogsGatewayWorkflowCost =
  {
    apiRequestCount: 0,
    applicationPoints: 0,
    cacheHitCount: 0,
    estimatedPoints: 0,
    totalPoints: 0,
    unmeasuredRequestCount: 0,
    userPoints: 0,
  };

const FellowshipLogsGatewayPointsSpent =
  Context.Reference<Ref.Ref<FellowshipLogsGatewayWorkflowCost> | null>(
    "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent/FellowshipLogsGatewayPointsSpent",
    {
      defaultValue: () => {
        return null;
      },
    },
  );

function addFellowshipLogsGatewayWorkflowCosts(
  first: FellowshipLogsGatewayWorkflowCost,
  second: FellowshipLogsGatewayWorkflowCost,
): FellowshipLogsGatewayWorkflowCost {
  return {
    apiRequestCount: first.apiRequestCount + second.apiRequestCount,
    applicationPoints: first.applicationPoints + second.applicationPoints,
    cacheHitCount: first.cacheHitCount + second.cacheHitCount,
    estimatedPoints: first.estimatedPoints + second.estimatedPoints,
    totalPoints: first.totalPoints + second.totalPoints,
    unmeasuredRequestCount:
      first.unmeasuredRequestCount + second.unmeasuredRequestCount,
    userPoints: first.userPoints + second.userPoints,
  };
}

export const addFellowshipLogsGatewayWorkflowCost = E.fn(
  "addFellowshipLogsGatewayWorkflowCost",
)(function* (cost: FellowshipLogsGatewayWorkflowCost) {
  const workflowCost = yield* FellowshipLogsGatewayPointsSpent;

  if (workflowCost !== null) {
    yield* Ref.update(workflowCost, (total) => {
      return addFellowshipLogsGatewayWorkflowCosts(total, cost);
    });
  }
});

export function addFellowshipLogsGatewayRequestCost({
  estimatedPoints,
  measured,
}: {
  readonly estimatedPoints: number;
  readonly measured: Option.Option<FellowshipLogsRequestCost>;
}) {
  return addFellowshipLogsGatewayWorkflowCost(
    Option.match(measured, {
      onNone: () => {
        return {
          ...EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
          apiRequestCount: 1,
          estimatedPoints,
          unmeasuredRequestCount: 1,
        };
      },
      onSome: (cost) => {
        return {
          ...EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
          apiRequestCount: 1,
          applicationPoints: cost.application,
          totalPoints: cost.total,
          userPoints: cost.user,
        };
      },
    }),
  );
}

export const addFellowshipLogsGatewayCacheHit = () => {
  return addFellowshipLogsGatewayWorkflowCost({
    ...EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
    cacheHitCount: 1,
  });
};

function getApproximatePointsSpent(cost: FellowshipLogsGatewayWorkflowCost) {
  return cost.totalPoints + cost.estimatedPoints;
}

export function withFellowshipLogsGatewayWorkflowCostRef(
  workflowCost: Ref.Ref<FellowshipLogsGatewayWorkflowCost>,
) {
  return <A, Err, Requirements>(effect: E.Effect<A, Err, Requirements>) => {
    return effect.pipe(
      E.provideService(FellowshipLogsGatewayPointsSpent, workflowCost),
    );
  };
}

export const withFellowshipLogsGatewayWorkflowCost = E.fn(
  "withFellowshipLogsGatewayWorkflowCost",
)(function* <A, Err, Requirements>(effect: E.Effect<A, Err, Requirements>) {
  const workflowCost = yield* Ref.make(
    EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST,
  );

  const result = yield* effect.pipe(
    withFellowshipLogsGatewayWorkflowCostRef(workflowCost),
  );

  return [result, yield* Ref.get(workflowCost)] as const;
});

export const withFellowshipLogsGatewayPointsSpent = E.fn(
  "withFellowshipLogsGatewayPointsSpent",
)(function* <A, Err, Requirements>(effect: E.Effect<A, Err, Requirements>) {
  const [result, cost] = yield* withFellowshipLogsGatewayWorkflowCost(effect);

  return [result, getApproximatePointsSpent(cost)] as const;
});

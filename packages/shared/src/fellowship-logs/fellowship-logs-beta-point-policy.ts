import { FELLOWSHIP_LOGS_POINT_POLICY_VERSION } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export type FellowshipLogsPointPool = "APPLICATION" | "DATABASE" | "USER";

type FellowshipLogsSubscription =
  | "GOLD"
  | "PLATINUM"
  | "SILVER"
  | "UNSUBSCRIBED";

export const FELLOWSHIP_LOGS_BETA_POINT_POLICY = {
  effectiveDate: "2026-10-20",
  limitsPerHour: {
    GOLD: { APPLICATION: 3000, DATABASE: 1050, USER: 400 },
    PLATINUM: { APPLICATION: 9000, DATABASE: 3200, USER: 800 },
    SILVER: { APPLICATION: 1000, DATABASE: 350, USER: 250 },
    UNSUBSCRIBED: { APPLICATION: 1000, DATABASE: 250, USER: 100 },
  },
  sourceUrl: "https://www.archon.gg/eso/articles/help/archon-api-updates-beta",
  version: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
} as const satisfies {
  readonly effectiveDate: string;
  readonly limitsPerHour: Record<
    FellowshipLogsSubscription,
    Record<FellowshipLogsPointPool, number>
  >;
  readonly sourceUrl: string;
  readonly version: string;
};

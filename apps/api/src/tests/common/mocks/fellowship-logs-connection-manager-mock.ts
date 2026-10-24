import * as Layer from "effect/Layer";

import {
  FellowshipLogsConnectionManager,
  type FellowshipLogsConnectionManagerShape,
} from "@frt/api/services/fellowship-logs-connection-manager/fellowship-logs-connection-manager-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeFellowshipLogsConnectionManagerMockOptions =
  Partial<FellowshipLogsConnectionManagerShape>;

export function makeFellowshipLogsConnectionManagerMock({
  cancelAuthorization = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "cancelAuthorization",
  ),
  checkPointSystemOptIn = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "checkPointSystemOptIn",
  ),
  completeAuthorization = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "completeAuthorization",
  ),
  disconnect = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "disconnect",
  ),
  getStatus = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "getStatus",
  ),
  saveOwnClient = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "saveOwnClient",
  ),
  startAuthorization = unexpectedEffectCall(
    "FellowshipLogsConnectionManager",
    "startAuthorization",
  ),
}: MakeFellowshipLogsConnectionManagerMockOptions = {}) {
  return Layer.succeed(FellowshipLogsConnectionManager, {
    cancelAuthorization,
    checkPointSystemOptIn,
    completeAuthorization,
    disconnect,
    getStatus,
    saveOwnClient,
    startAuthorization,
  } satisfies FellowshipLogsConnectionManagerShape);
}

export const FellowshipLogsConnectionManagerMock =
  makeFellowshipLogsConnectionManagerMock();

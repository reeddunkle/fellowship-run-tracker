import { QueryClient } from "@tanstack/react-query";
import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { describe, expect, test, vi } from "vitest";

vi.hoisted(() => {
  vi.stubGlobal("window", { addEventListener: vi.fn() });
});

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeFellowshipLogsConnectionManagerMock } from "@frt/api/tests/common/mocks/fellowship-logs-connection-manager-mock.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import { saveOwnClient } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-client.ts";
import { invalidateFellowshipLogsConnectionStatus } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-invalidation.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { runWithTestApiServer } from "@/tests/browser/common/run-with-test-api-server.ts";

const CLIENT_ID = FellowshipLogsClientIdSchema.make("marker-client-id");
const CLIENT_SECRET = "marker-client-secret-4785296b";
const GENERATION = FellowshipLogsConnectionGenerationSchema.make(
  "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
);

describe("Fellowship Logs connection client", () => {
  test("saves a connection through the local API and invalidates its query", async () => {
    const receivedOptions: Array<unknown> = [];
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const layer = makeApiServerTestLayerWith(
      makeFellowshipLogsConnectionManagerMock({
        saveOwnClient: (options) => {
          receivedOptions.push({
            ...options,
            clientSecret: Redacted.value(options.clientSecret),
          });

          return E.succeed({
            clientId: CLIENT_ID,
            connectedUserName: null,
            generation: GENERATION,
            pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
            profile: "OWN_CLIENT",
            spending: "DEFAULT",
            status: "CONNECTED",
            storageProtection: "OS_BACKED",
          });
        },
      }),
    );

    const connection = await runWithTestApiServer(
      E.gen(function* () {
        const saved = yield* saveOwnClient({
          allowLocalFallback: false,
          clientId: CLIENT_ID,
          clientSecret: Redacted.make(CLIENT_SECRET),
          expectedGeneration: null,
          replaceConnection: false,
        });

        yield* invalidateFellowshipLogsConnectionStatus(queryClient);

        return saved;
      }),
      layer,
    );

    expect(connection).toMatchObject({
      clientId: CLIENT_ID,
      generation: GENERATION,
      profile: "OWN_CLIENT",
      status: "CONNECTED",
    });
    expect(receivedOptions).toEqual([
      {
        allowLocalFallback: false,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        expectedGeneration: null,
        replaceConnection: false,
      },
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: getFellowshipLogsConnectionStatusQueryOptions().queryKey,
    });
  });
});

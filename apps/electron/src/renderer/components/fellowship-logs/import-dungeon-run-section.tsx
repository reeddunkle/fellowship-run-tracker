import { useQuery } from "@tanstack/react-query";
import { CircleCheckIcon } from "lucide-react";
import { useState } from "react";

import {
  type FellowshipLogsApiDungeonRunReference,
  type FellowshipLogsApiQueueDungeonRunImportResult,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

import {
  useDungeonRunMetadata,
  useQueueDungeonRunImport,
} from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { getPointPoolsBlock } from "@/renderer/api/fellowship-logs/fellowship-logs-point-messages.ts";
import { getFellowshipLogsPointPoolsQueryOptions } from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

import { getConnectionBlockedMessage } from "./connection/get-connection-blocked-message.ts";
import { ImportConfirmationCard } from "./import-confirmation/import-confirmation-card.tsx";
import { type DecodedImportConfirmationFormValue } from "./import-confirmation/import-confirmation-form-schema.ts";
import { getMetadataErrorMessage } from "./import-url-form/get-metadata-error-message.ts";
import { ImportUrlForm } from "./import-url-form/import-url-form.tsx";

function ImportQueuedMessage({
  result,
}: {
  readonly result: FellowshipLogsApiQueueDungeonRunImportResult;
}) {
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);

  const { dungeonId, dungeonLevel } = result.job.payload;
  const runName = `${dungeonsById[dungeonId]?.name ?? dungeonId} +${dungeonLevel}`;

  return (
    <output className="flex items-center gap-2 text-sm">
      <CircleCheckIcon aria-hidden="true" className="size-4 text-success" />
      {result.wasAlreadyQueued
        ? `${runName} is already in the import queue.`
        : `Added ${runName} to the import queue. You can import another run.`}
    </output>
  );
}

export function ImportDungeonRunSection() {
  const [formKey, setFormKey] = useState(0);

  const metadataMutation = useDungeonRunMetadata();
  const queueMutation = useQueueDungeonRunImport();
  const nowMilliseconds = useNowMilliseconds();
  const connectionStatusQuery = useQuery(
    getFellowshipLogsConnectionStatusQueryOptions(),
  );
  const pointPoolsQuery = useQuery(getFellowshipLogsPointPoolsQueryOptions());

  const reference: FellowshipLogsApiDungeonRunReference | undefined =
    metadataMutation.variables;

  function handleLookup(nextReference: FellowshipLogsApiDungeonRunReference) {
    queueMutation.reset();
    metadataMutation.lookup(nextReference);
  }

  function handleCancel() {
    metadataMutation.reset();
    queueMutation.reset();
  }

  function handleConfirm({ isOwnRun }: DecodedImportConfirmationFormValue) {
    if (reference === undefined || metadataMutation.data === undefined) {
      return;
    }

    queueMutation.queueImport(
      {
        ...reference,
        dungeonId: metadataMutation.data.dungeonId,
        dungeonLevel: metadataMutation.data.dungeonLevel,
        isOwnRun,
        lookupWorkflowId: metadataMutation.data.lookupWorkflowId,
      },
      {
        onSuccess: () => {
          metadataMutation.reset();
          setFormKey((count) => {
            return count + 1;
          });
        },
      },
    );
  }

  const connectionBlockedMessage = getConnectionBlockedMessage(
    connectionStatusQuery.data,
  );

  const pointPoolsBlock = getPointPoolsBlock(
    pointPoolsQuery.data,
    connectionStatusQuery.data?.connection?.profile,
    nowMilliseconds,
  );

  return (
    <div className="grid gap-4">
      <ImportUrlForm
        blockedMessage={
          connectionBlockedMessage ?? pointPoolsBlock?.lookupMessage
        }
        errorMessage={
          metadataMutation.error === null
            ? undefined
            : getMetadataErrorMessage(metadataMutation.error, nowMilliseconds)
        }
        isSubmitting={metadataMutation.isPending}
        key={formKey}
        onSubmit={handleLookup}
      />
      {queueMutation.data !== undefined ? (
        <ImportQueuedMessage result={queueMutation.data} />
      ) : null}
      {metadataMutation.data !== undefined && reference !== undefined ? (
        <ImportConfirmationCard
          error={queueMutation.error ?? undefined}
          isQueueing={queueMutation.isPending}
          key={`${reference.reportCode}:${reference.fightId}`}
          metadata={metadataMutation.data}
          notice={pointPoolsBlock?.queueNotice}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          reference={reference}
        />
      ) : null}
    </div>
  );
}

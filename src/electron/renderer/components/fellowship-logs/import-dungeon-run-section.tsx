import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  getDungeonRunMetadataMutationOptions,
  importDungeonRunMutationOptions,
} from "@/electron/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { type FellowshipLogsApiDungeonRunReference } from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

import { ImportConfirmationCard } from "./import-confirmation/import-confirmation-card.tsx";
import { type DecodedImportConfirmationFormValue } from "./import-confirmation/import-confirmation-form-schema.ts";
import { ImportUrlForm } from "./import-url-form.tsx";

export function ImportDungeonRunSection() {
  const queryClient = useQueryClient();
  const [formKey, setFormKey] = useState(0);

  const metadataMutation = useMutation(
    getDungeonRunMetadataMutationOptions(queryClient),
  );
  const importMutation = useMutation(
    importDungeonRunMutationOptions(queryClient),
  );

  const reference: FellowshipLogsApiDungeonRunReference | undefined =
    metadataMutation.variables;

  function handleLookup(nextReference: FellowshipLogsApiDungeonRunReference) {
    importMutation.reset();
    metadataMutation.mutate(nextReference);
  }

  function handleCancel() {
    metadataMutation.reset();
    importMutation.reset();
  }

  function handleConfirm({ isOwnRun }: DecodedImportConfirmationFormValue) {
    if (reference === undefined) {
      return;
    }

    importMutation.mutate(
      {
        ...reference,
        isOwnRun,
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

  return (
    <div className="grid gap-4">
      <ImportUrlForm
        error={metadataMutation.error ?? undefined}
        isSubmitting={metadataMutation.isPending}
        key={formKey}
        onSubmit={handleLookup}
      />
      {metadataMutation.data !== undefined && reference !== undefined ? (
        <ImportConfirmationCard
          error={importMutation.error ?? undefined}
          isImporting={importMutation.isPending}
          key={`${reference.reportCode}:${reference.fightId}`}
          metadata={metadataMutation.data}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          reference={reference}
        />
      ) : null}
    </div>
  );
}

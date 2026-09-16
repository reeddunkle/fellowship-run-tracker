import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  getDungeonRunMetadataMutationOptions,
  importDungeonRunMutationOptions,
} from "@/electron/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useFellowshipLogsStore } from "@/electron/renderer/stores/fellowship-logs-store/use-fellowship-logs-store.ts";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import { type FellowshipLogsApiDungeonRunReference } from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

import { ImportConfirmationCard } from "./import-confirmation-card.tsx";
import { ImportUrlForm } from "./import-url-form.tsx";

type ImportDungeonRunSectionProps = {
  readonly dungeons: DungeonApiDungeonList;
};

export function ImportDungeonRunSection({
  dungeons,
}: ImportDungeonRunSectionProps) {
  const queryClient = useQueryClient();
  const { loadLastKnownRateLimitData } = useFellowshipLogsStore();
  const [formKey, setFormKey] = useState(0);

  const metadataMutation = useMutation(getDungeonRunMetadataMutationOptions());
  const importMutation = useMutation(
    importDungeonRunMutationOptions(queryClient),
  );

  const reference: FellowshipLogsApiDungeonRunReference | undefined =
    metadataMutation.variables;

  function handleLookup(nextReference: FellowshipLogsApiDungeonRunReference) {
    importMutation.reset();
    metadataMutation.mutate(nextReference, {
      onSuccess: () => {
        loadLastKnownRateLimitData();
      },
    });
  }

  function handleCancel() {
    metadataMutation.reset();
    importMutation.reset();
  }

  function handleConfirm() {
    if (reference === undefined) {
      return;
    }

    importMutation.mutate(reference, {
      onSuccess: () => {
        metadataMutation.reset();
        setFormKey((count) => {
          return count + 1;
        });
        loadLastKnownRateLimitData();
      },
    });
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
          dungeons={dungeons}
          error={importMutation.error ?? undefined}
          isImporting={importMutation.isPending}
          metadata={metadataMutation.data}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          reference={reference}
        />
      ) : null}
    </div>
  );
}

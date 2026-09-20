import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/electron/renderer/components/ui/card.tsx";
import { Checkbox } from "@/electron/renderer/components/ui/checkbox.tsx";
import { Field, FieldLabel } from "@/electron/renderer/components/ui/field.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import { useFellowshipDataStore } from "@/electron/renderer/stores/fellowship-data/fellowship-data-store.tsx";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
} from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

import { useImportConfirmationForm } from "./import-confirmation-form.ts";
import { type DecodedImportConfirmationFormValue } from "./import-confirmation-form-schema.ts";

const IMPORT_CONFIRMATION_FORM_DOM_ID = "import-dungeon-run-confirmation-form";

function formatDuration(
  startedAtMilliseconds: number,
  endedAtMilliseconds: number,
): string {
  const totalSeconds = Math.round(
    (endedAtMilliseconds - startedAtMilliseconds) / 1000,
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type ImportConfirmationCardProps = {
  readonly error: unknown;
  readonly isImporting: boolean;
  readonly metadata: FellowshipLogsApiDungeonRunMetadata;
  readonly onCancel: () => void;
  readonly onConfirm: (value: DecodedImportConfirmationFormValue) => void;
  readonly reference: FellowshipLogsApiDungeonRunReference;
};

export function ImportConfirmationCard({
  error,
  isImporting,
  metadata,
  onCancel,
  onConfirm,
  reference,
}: ImportConfirmationCardProps) {
  const dungeonsById = useFellowshipDataStore((state) => state.dungeonsById);

  const dungeonName =
    dungeonsById[metadata.dungeonId]?.name ?? metadata.dungeonId;

  const form = useImportConfirmationForm({
    onConfirm,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm import</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Dungeon</dt>
            <dd className="font-medium">{dungeonName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Level</dt>
            <dd className="font-medium">{metadata.dungeonLevel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-medium">
              {formatDuration(
                metadata.startedAtMilliseconds,
                metadata.endedAtMilliseconds,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Report / fight</dt>
            <dd className="font-medium">
              {reference.reportCode} / {reference.fightId}
            </dd>
          </div>
        </dl>
        <form
          id={IMPORT_CONFIRMATION_FORM_DOM_ID}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();

            void form.handleSubmit();
          }}
        >
          <form.Field name="isOwnRun">
            {(field) => {
              return (
                <Field orientation="horizontal">
                  <Checkbox
                    checked={field.state.value}
                    disabled={isImporting}
                    id={field.name}
                    onCheckedChange={(checked) => {
                      field.handleChange(checked === true);
                    }}
                  />
                  <FieldLabel htmlFor={field.name}>This run is mine</FieldLabel>
                </Field>
              );
            }}
          </form.Field>
        </form>
        <div className="flex items-center gap-3">
          <Button
            disabled={isImporting}
            form={IMPORT_CONFIRMATION_FORM_DOM_ID}
            type="submit"
          >
            {isImporting ? <Spinner /> : <CheckIcon />}
            {isImporting ? "Importing..." : "Import"}
          </Button>
          <Button
            disabled={isImporting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            <XIcon />
            Cancel
          </Button>
          {error !== undefined ? (
            <p className="text-sm text-destructive">
              Failed to import this run.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

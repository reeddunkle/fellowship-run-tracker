import {
  AlertTriangleIcon,
  ClockIcon,
  ListPlusIcon,
  XIcon,
} from "lucide-react";

import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
} from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { getErrorTag } from "@frt/shared/util/get-error-tag.ts";
import { Button } from "@frt/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@frt/ui/card.tsx";
import { Checkbox } from "@frt/ui/checkbox.tsx";
import { Field, FieldLabel } from "@frt/ui/field.tsx";
import { Spinner } from "@frt/ui/spinner.tsx";

import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

import { useImportConfirmationForm } from "./import-confirmation-form.ts";
import { type DecodedImportConfirmationFormValue } from "./import-confirmation-form-schema.ts";

const IMPORT_CONFIRMATION_FORM_DOM_ID = "import-dungeon-run-confirmation-form";

function getQueueErrorMessage(error: unknown): string {
  return getErrorTag(error) === "FellowshipLogsApiAlreadyImportedError"
    ? "This run has already been imported."
    : "Couldn't add this run to the import queue.";
}

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
  readonly isQueueing: boolean;
  readonly metadata: FellowshipLogsApiDungeonRunMetadata;
  readonly notice: string | undefined;
  readonly onCancel: () => void;
  readonly onConfirm: (value: DecodedImportConfirmationFormValue) => void;
  readonly reference: FellowshipLogsApiDungeonRunReference;
};

export function ImportConfirmationCard({
  error,
  isQueueing,
  metadata,
  notice,
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
        {metadata.isInProgress ? (
          <p className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangleIcon aria-hidden="true" className="size-4 shrink-0" />
            This fight is still in progress. It will be imported as it is now,
            and its data won't be cached, so importing it again will use points
            again.
          </p>
        ) : null}
        {notice === undefined ? null : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClockIcon aria-hidden="true" className="size-4" />
            {notice}
          </p>
        )}
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
                    disabled={isQueueing}
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
            disabled={isQueueing}
            form={IMPORT_CONFIRMATION_FORM_DOM_ID}
            type="submit"
          >
            {isQueueing ? <Spinner /> : <ListPlusIcon />}
            {isQueueing ? "Adding to queue..." : "Add to import queue"}
          </Button>
          <Button
            disabled={isQueueing}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            <XIcon />
            Cancel
          </Button>
          {error !== undefined ? (
            <p className="text-sm text-destructive">
              {getQueueErrorMessage(error)}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

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
import {
  Stat,
  StatLabel,
  StatList,
  StatValue,
} from "@frt/ui/composites/stat-list.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@frt/ui/primitives/card.tsx";
import { Checkbox } from "@frt/ui/primitives/checkbox.tsx";
import { Field, FieldLabel } from "@frt/ui/primitives/field.tsx";
import { Spinner } from "@frt/ui/primitives/spinner.tsx";

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
      <CardContent>
        <StatList className="grid-cols-2 sm:grid-cols-4">
          <Stat>
            <StatLabel>Dungeon</StatLabel>
            <StatValue>{dungeonName}</StatValue>
          </Stat>
          <Stat>
            <StatLabel>Level</StatLabel>
            <StatValue>{metadata.dungeonLevel}</StatValue>
          </Stat>
          <Stat>
            <StatLabel>Duration</StatLabel>
            <StatValue>
              {formatDuration(
                metadata.startedAtMilliseconds,
                metadata.endedAtMilliseconds,
              )}
            </StatValue>
          </Stat>
          <Stat>
            <StatLabel>Report / fight</StatLabel>
            <StatValue>
              {reference.reportCode} / {reference.fightId}
            </StatValue>
          </Stat>
        </StatList>
        {metadata.isInProgress ? (
          <StatusText variant="warning">
            <AlertTriangleIcon aria-hidden="true" />
            This fight is still in progress. It will be imported as it is now,
            and its data won't be cached, so importing it again will use points
            again.
          </StatusText>
        ) : null}
        {notice === undefined ? null : (
          <StatusText>
            <ClockIcon aria-hidden="true" />
            {notice}
          </StatusText>
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
            <StatusText variant="destructive">
              {getQueueErrorMessage(error)}
            </StatusText>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

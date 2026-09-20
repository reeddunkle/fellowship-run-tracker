import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { SearchIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/electron/renderer/components/ui/field.tsx";
import { Input } from "@/electron/renderer/components/ui/input.tsx";
import { type FellowshipLogsApiDungeonRunReference } from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";
import { getErrorTag } from "@/util/get-error-tag.ts";

import {
  ImportDungeonRunUrlFormSchema,
  ImportDungeonRunUrlFormStandardSchema,
} from "./import-url-form-schema.ts";

const IMPORT_URL_FORM_DOM_ID = "import-dungeon-run-url-form";

function getMetadataErrorMessage(error: unknown): string {
  const tag = getErrorTag(error);

  if (tag === "FellowshipLogsApiRunNotFoundError") {
    return "We couldn't find that report and fight. Double-check the URL.";
  }

  if (tag === "FellowshipLogsApiRunNotFinishedError") {
    return "This run hasn't finished yet. Try again once it's complete in Fellowship Logs.";
  }

  return "Something went wrong contacting Fellowship Logs.";
}

type ImportUrlFormProps = {
  readonly error: unknown;
  readonly isSubmitting: boolean;
  readonly onSubmit: (reference: FellowshipLogsApiDungeonRunReference) => void;
};

export function ImportUrlForm({
  error,
  isSubmitting,
  onSubmit,
}: ImportUrlFormProps) {
  const form = useForm({
    defaultValues: {
      reportUrl: "",
    },

    onSubmit: ({ value }) => {
      return E.gen(function* () {
        const decoded = yield* Schema.decodeEffect(
          ImportDungeonRunUrlFormSchema,
        )(value);

        onSubmit(decoded.reportUrl);
      }).pipe(E.runPromise);
    },

    validators: {
      onChange: ImportDungeonRunUrlFormStandardSchema,
      onSubmit: ImportDungeonRunUrlFormStandardSchema,
    },
  });

  return (
    <form
      id={IMPORT_URL_FORM_DOM_ID}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="reportUrl">
          {(field) => {
            return (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Fellowship Logs report URL
                </FieldLabel>
                <Input
                  autoComplete="off"
                  id={field.name}
                  name={field.name}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                  }}
                  placeholder="https://www.fellowshiplogs.com/reports/<code>?fight=<id>"
                  spellCheck={false}
                  value={field.state.value}
                />
                {field.state.meta.errors.length > 0 ? (
                  <FieldError errors={field.state.meta.errors} />
                ) : null}
              </Field>
            );
          }}
        </form.Field>
        <div className="flex items-center gap-3">
          <Button disabled={isSubmitting} type="submit">
            <SearchIcon />
            {isSubmitting ? "Looking up run..." : "Look up run"}
          </Button>
          {error !== undefined ? (
            <p className="text-sm text-destructive">
              {getMetadataErrorMessage(error)}
            </p>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}

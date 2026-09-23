import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { SearchIcon } from "lucide-react";

import { type FellowshipLogsApiDungeonRunReference } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";
import { Button } from "@frt/ui/button.tsx";
import { Field, FieldError, FieldGroup, FieldLabel } from "@frt/ui/field.tsx";
import { Input } from "@frt/ui/input.tsx";

import {
  ImportDungeonRunUrlFormSchema,
  ImportDungeonRunUrlFormStandardSchema,
} from "./import-url-form-schema.ts";

const IMPORT_URL_FORM_DOM_ID = "import-dungeon-run-url-form";

type ImportUrlFormProps = {
  /**
   * Why looking up a run isn't possible right now (e.g. out of points).
   * Disables the lookup.
   */
  readonly blockedMessage: string | undefined;
  readonly errorMessage: string | undefined;
  readonly isSubmitting: boolean;
  readonly onSubmit: (reference: FellowshipLogsApiDungeonRunReference) => void;
};

export function ImportUrlForm({
  blockedMessage,
  errorMessage,
  isSubmitting,
  onSubmit,
}: ImportUrlFormProps) {
  const message = blockedMessage ?? errorMessage;

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
          <Button
            disabled={isSubmitting || blockedMessage !== undefined}
            type="submit"
          >
            <SearchIcon />
            {isSubmitting ? "Looking up run..." : "Look up run"}
          </Button>
          {message === undefined ? null : (
            <p className="text-sm text-destructive">{message}</p>
          )}
        </div>
      </FieldGroup>
    </form>
  );
}

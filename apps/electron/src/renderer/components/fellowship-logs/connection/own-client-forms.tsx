import { useForm } from "@tanstack/react-form";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import { KeyRoundIcon, LogInIcon } from "lucide-react";

import {
  type FellowshipLogsClientId,
  FellowshipLogsClientIdSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";
import { Button } from "@frt/ui/primitives/button.tsx";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@frt/ui/primitives/field.tsx";
import { Input } from "@frt/ui/primitives/input.tsx";

import { OwnClientRequirements } from "./own-client-requirements.tsx";

const OwnApiClientFormSchema = Schema.Struct({
  clientId: FellowshipLogsClientIdSchema,
  clientSecret: NonEmptyStringSchema,
});

const OwnApiClientFormStandardSchema = Schema.toStandardSchemaV1(
  OwnApiClientFormSchema,
);

const OwnClientSignInFormSchema = Schema.Struct({
  clientId: FellowshipLogsClientIdSchema,
});

const OwnClientSignInFormStandardSchema = Schema.toStandardSchemaV1(
  OwnClientSignInFormSchema,
);

type OwnApiClientFormProps = {
  readonly isPending: boolean;
  readonly onSubmit: (credentials: {
    readonly clientId: FellowshipLogsClientId;
    readonly clientSecret: string;
  }) => void;
};

export function OwnApiClientForm({
  isPending,
  onSubmit,
}: OwnApiClientFormProps) {
  const form = useForm({
    defaultValues: { clientId: "", clientSecret: "" },
    onSubmit: ({ value }) => {
      return Schema.decodeEffect(OwnApiClientFormSchema)(value).pipe(
        E.map(onSubmit),
        E.runPromise,
      );
    },
    validators: { onSubmit: OwnApiClientFormStandardSchema },
  });

  return (
    <form
      aria-label="Use my API client credentials"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <OwnClientRequirements mode="credentials" />
        <form.Field name="clientId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="own-api-client-id">Client ID</FieldLabel>
              <Input
                autoComplete="off"
                id="own-api-client-id"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                spellCheck={false}
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <form.Field name="clientSecret">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="own-api-client-secret">
                Client secret
              </FieldLabel>
              <Input
                autoComplete="off"
                id="own-api-client-secret"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                spellCheck={false}
                type="password"
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <div>
          <Button disabled={isPending} type="submit" variant="outline">
            <KeyRoundIcon />
            {isPending ? "Checking client..." : "Check and save client"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

type OwnClientSignInFormProps = {
  readonly initialClientId: FellowshipLogsClientId | null;
  readonly isPending: boolean;
  readonly onSubmit: (clientId: FellowshipLogsClientId) => void;
};

export function OwnClientSignInForm({
  initialClientId,
  isPending,
  onSubmit,
}: OwnClientSignInFormProps) {
  const form = useForm({
    defaultValues: { clientId: initialClientId ?? "" },
    onSubmit: ({ value }) => {
      return Schema.decodeEffect(OwnClientSignInFormSchema)(value).pipe(
        E.map(({ clientId }) => {
          return onSubmit(clientId);
        }),
        E.runPromise,
      );
    },
    validators: { onSubmit: OwnClientSignInFormStandardSchema },
  });

  return (
    <form
      aria-label="Sign in with my API client"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();

        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <OwnClientRequirements mode="sign-in" />
        <form.Field name="clientId">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="own-client-user-client-id">
                Public client ID
              </FieldLabel>
              <Input
                autoComplete="off"
                id="own-client-user-client-id"
                name={field.name}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                }}
                spellCheck={false}
                value={field.state.value}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
        <div>
          <Button disabled={isPending} type="submit" variant="outline">
            <LogInIcon />
            Sign in with my client
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

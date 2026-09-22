import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { ThemeSchema } from "@frt/shared/app-state/app-state-schema.ts";
import { Card, CardContent } from "@frt/ui/card.tsx";
import { Field, FieldLabel } from "@frt/ui/field.tsx";
import { NativeSelect, NativeSelectOption } from "@frt/ui/native-select.tsx";

import { useTheme } from "@/renderer/components/providers/theme-provider.tsx";

const themeOptions = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

type Theme = (typeof themeOptions)[number]["value"];

function decodeTheme(value: string): Theme | undefined {
  const result = Schema.decodeUnknownResult(ThemeSchema)(value);

  return Result.match(result, {
    onFailure: () => undefined,
    onSuccess: (theme) => theme,
  });
}

export function AppearanceSettings() {
  const { setTheme, theme } = useTheme();

  return (
    <Card>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="theme">Theme</FieldLabel>
          <NativeSelect
            className="w-full max-w-48"
            id="theme"
            onChange={(event) => {
              const validatedTheme = decodeTheme(event.target.value);

              if (validatedTheme !== undefined) {
                setTheme(validatedTheme);
              }
            }}
            value={theme}
          >
            {themeOptions.map(({ value, label }) => {
              return (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              );
            })}
          </NativeSelect>
        </Field>
      </CardContent>
    </Card>
  );
}

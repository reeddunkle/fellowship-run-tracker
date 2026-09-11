import {
  NativeSelect,
  NativeSelectOption,
} from "@/electron/renderer/components/ui/native-select.tsx";

export const CUSTOM_TARGET = "__CUSTOM__" as const;

type TargetOption = {
  readonly label: string;
  readonly value: string;
};

type TargetSelectProps = {
  readonly id: string;
  readonly isInvalid: boolean;
  readonly name: string;
  readonly options: ReadonlyArray<TargetOption>;
  readonly value: string;
  readonly onBlur: () => void;
  readonly onChange: (value: string) => void;
};

export function TargetSelect({
  id,
  isInvalid,
  name,
  onBlur,
  onChange,
  options,
  value,
}: TargetSelectProps) {
  return (
    <NativeSelect
      aria-invalid={isInvalid}
      id={id}
      name={name}
      onBlur={onBlur}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      value={value}
    >
      <NativeSelectOption value={CUSTOM_TARGET}>Custom</NativeSelectOption>
      {options.map((option) => {
        return (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        );
      })}
    </NativeSelect>
  );
}

import * as Match from "effect/Match";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

export const CONFIGURATION_SORT_OPTIONS = [
  {
    Icon: ArrowDownIcon,
    label: "Newest first",
    value: "UPDATED_DESCENDING",
  },
  {
    Icon: ArrowUpIcon,
    label: "Oldest first",
    value: "UPDATED_ASCENDING",
  },
] as const;

export type ConfigurationSort =
  (typeof CONFIGURATION_SORT_OPTIONS)[number]["value"];

export type ConfigurationSortOption =
  (typeof CONFIGURATION_SORT_OPTIONS)[number];

export const DEFAULT_CONFIGURATION_SORT: ConfigurationSort =
  "UPDATED_DESCENDING";

export function getConfigurationSortOption(
  sort: ConfigurationSort,
): ConfigurationSortOption {
  return Match.value(sort).pipe(
    Match.when("UPDATED_DESCENDING", () => CONFIGURATION_SORT_OPTIONS[0]),
    Match.when("UPDATED_ASCENDING", () => CONFIGURATION_SORT_OPTIONS[1]),
    Match.exhaustive,
  );
}

export function ConfigurationSortOptionContent({
  option,
}: {
  readonly option: ConfigurationSortOption;
}) {
  const { Icon, label } = option;

  return (
    <span className="flex items-center gap-2">
      <Icon />
      {label}
    </span>
  );
}

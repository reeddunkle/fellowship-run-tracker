import { type QueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { DEFAULT_APP_STATE } from "@/contracts/app-state/app-state-schema.ts";
import { type ConfigurationApiConfiguration } from "@/contracts/configuration/configuration-api-schema.ts";
import { getConfigurationsQueryOptions } from "@/electron/renderer/api/configuration/configuration-queries.ts";
import { ConfigurationProvider } from "@/electron/renderer/stores/configuration/configuration-provider.tsx";
import { seedAppStateQueries } from "@/tests/browser/helpers/seed-app-state-queries.ts";

export function TestConfigurationProvider({
  children,
  client,
  configuration,
}: {
  readonly children: ReactNode;
  readonly client: QueryClient;
  readonly configuration: ConfigurationApiConfiguration;
}) {
  useState(() => {
    client.setQueryData(getConfigurationsQueryOptions().queryKey, [
      configuration,
    ]);
    seedAppStateQueries(client, {
      ...DEFAULT_APP_STATE,
      selectedConfigurationId: configuration.id,
    });
  });

  return <ConfigurationProvider>{children}</ConfigurationProvider>;
}

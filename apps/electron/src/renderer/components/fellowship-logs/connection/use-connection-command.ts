import { useState } from "react";

import { type ConnectionCommandFlags } from "./connection-command-feedback.tsx";

type ConnectionCommandOptions = {
  readonly allowLocalFallback: boolean;
  readonly replaceConnection: boolean;
};

export function useConnectionCommand<Options extends ConnectionCommandOptions>(
  send: (options: Options) => void,
) {
  const [lastOptions, setLastOptions] = useState<Options | null>(null);

  function run(options: Options) {
    setLastOptions(options);
    send(options);
  }

  function retry(flags: ConnectionCommandFlags) {
    if (lastOptions === null) {
      return;
    }

    run({ ...lastOptions, ...flags });
  }

  return { retry, run };
}

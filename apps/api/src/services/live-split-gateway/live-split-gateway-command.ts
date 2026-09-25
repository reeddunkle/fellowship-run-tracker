export const LiveSplitGatewaySendCommand = {
  pause: "pause",
  reset: "reset",
  setComparison: "setcomparison",
  setCurrentSplitName: "setcurrentsplitname",
  split: "split",
  startTimer: "starttimer",
} as const;

export type LiveSplitGatewaySendCommand =
  (typeof LiveSplitGatewaySendCommand)[keyof typeof LiveSplitGatewaySendCommand];

export const LiveSplitGatewayRequestCommand = {
  getCurrentTime: "getcurrenttime",
  getLiveSplitVersion: "getlivesplitversion",
  getServerType: "getservertype",
  getSplitIndex: "getsplitindex",
  getSplitsPath: "getsplitspath",
  getTimerPhase: "getcurrenttimerphase",
  ping: "ping",
  saveSplitsAs: "savesplitsas",
  switchSplits: "switchsplits",
} as const;

export type LiveSplitGatewayRequestCommand =
  (typeof LiveSplitGatewayRequestCommand)[keyof typeof LiveSplitGatewayRequestCommand];

export type LiveSplitGatewaySendCommandInput =
  | {
      readonly command: typeof LiveSplitGatewaySendCommand.pause;
    }
  | {
      readonly command: typeof LiveSplitGatewaySendCommand.reset;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitGatewaySendCommand.setComparison;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitGatewaySendCommand.setCurrentSplitName;
    }
  | {
      readonly command: typeof LiveSplitGatewaySendCommand.split;
    }
  | {
      readonly command: typeof LiveSplitGatewaySendCommand.startTimer;
    };

export type LiveSplitGatewayRequestCommandInput =
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getCurrentTime;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getLiveSplitVersion;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getServerType;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getSplitIndex;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getSplitsPath;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.getTimerPhase;
    }
  | {
      readonly command: typeof LiveSplitGatewayRequestCommand.ping;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitGatewayRequestCommand.saveSplitsAs;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitGatewayRequestCommand.switchSplits;
    };

export type LiveSplitGatewayCommandInput =
  | LiveSplitGatewayRequestCommandInput
  | LiveSplitGatewaySendCommandInput;

type LiveSplitCommandWithArgument = Extract<
  LiveSplitGatewayCommandInput,
  { readonly argument: string }
>;

export const LIVE_SPLIT_GATEWAY_EOL = "\r\n";

export function appendEOL(value: string): string {
  return `${value}${LIVE_SPLIT_GATEWAY_EOL}`;
}

function hasCommandArgument(
  input: LiveSplitGatewayCommandInput,
): input is LiveSplitCommandWithArgument {
  return "argument" in input;
}

function sanitizeCommandArgument(argument: string): string {
  return argument.replaceAll(/[\r\n]/g, " ");
}

export function formatLiveSplitGatewayCommand(
  input: LiveSplitGatewayCommandInput,
): string {
  if (!hasCommandArgument(input)) {
    return appendEOL(input.command);
  }

  const argument = sanitizeCommandArgument(input.argument);

  return appendEOL(`${input.command} ${argument}`);
}

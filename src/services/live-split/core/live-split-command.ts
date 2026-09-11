export const LiveSplitSendCommand = {
  pause: "pause",
  reset: "reset",
  setComparison: "setcomparison",
  setCurrentSplitName: "setcurrentsplitname",
  split: "split",
  startTimer: "starttimer",
} as const;

export type LiveSplitSendCommand =
  (typeof LiveSplitSendCommand)[keyof typeof LiveSplitSendCommand];

export const LiveSplitRequestCommand = {
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

export type LiveSplitRequestCommand =
  (typeof LiveSplitRequestCommand)[keyof typeof LiveSplitRequestCommand];

export type LiveSplitSendCommandInput =
  | {
      readonly command: typeof LiveSplitSendCommand.pause;
    }
  | {
      readonly command: typeof LiveSplitSendCommand.reset;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitSendCommand.setComparison;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitSendCommand.setCurrentSplitName;
    }
  | {
      readonly command: typeof LiveSplitSendCommand.split;
    }
  | {
      readonly command: typeof LiveSplitSendCommand.startTimer;
    };

export type LiveSplitRequestCommandInput =
  | {
      readonly command: typeof LiveSplitRequestCommand.getCurrentTime;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.getLiveSplitVersion;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.getServerType;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.getSplitIndex;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.getSplitsPath;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.getTimerPhase;
    }
  | {
      readonly command: typeof LiveSplitRequestCommand.ping;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitRequestCommand.saveSplitsAs;
    }
  | {
      readonly argument: string;
      readonly command: typeof LiveSplitRequestCommand.switchSplits;
    };

export type LiveSplitCommandInput =
  | LiveSplitRequestCommandInput
  | LiveSplitSendCommandInput;

type LiveSplitCommandWithArgument = Extract<
  LiveSplitCommandInput,
  { readonly argument: string }
>;

export const LIVE_SPLIT_EOL = "\r\n";

export function appendEOL(value: string): string {
  return `${value}${LIVE_SPLIT_EOL}`;
}

function hasCommandArgument(
  input: LiveSplitCommandInput,
): input is LiveSplitCommandWithArgument {
  return "argument" in input;
}

function sanitizeCommandArgument(argument: string): string {
  return argument.replaceAll(/[\r\n]/g, " ");
}

export function formatLiveSplitCommand(input: LiveSplitCommandInput): string {
  if (!hasCommandArgument(input)) {
    return appendEOL(input.command);
  }

  const argument = sanitizeCommandArgument(input.argument);

  return appendEOL(`${input.command} ${argument}`);
}

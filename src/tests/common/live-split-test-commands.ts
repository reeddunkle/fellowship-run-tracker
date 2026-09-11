import {
  appendEOL,
  LiveSplitSendCommand,
} from "@/services/live-split/core/live-split-command.ts";

export const dungeonStartCommands = [
  appendEOL(LiveSplitSendCommand.reset),
  appendEOL(LiveSplitSendCommand.startTimer),
];

export const dungeonEndCommands = [appendEOL(LiveSplitSendCommand.pause)];

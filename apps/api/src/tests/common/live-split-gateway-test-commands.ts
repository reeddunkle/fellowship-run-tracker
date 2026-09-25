import {
  appendEOL,
  LiveSplitGatewaySendCommand,
} from "@frt/api/services/live-split-gateway/live-split-gateway-command.ts";

export const dungeonStartCommands = [
  appendEOL(LiveSplitGatewaySendCommand.reset),
  appendEOL(LiveSplitGatewaySendCommand.startTimer),
];

export const dungeonEndCommands = [
  appendEOL(LiveSplitGatewaySendCommand.pause),
];

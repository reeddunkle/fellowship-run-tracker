# Disconnect LiveSplit when the setting is turned off

## Problem

`isLiveSplitEnabled` only affects the renderer. Turning it off hides the LiveSplit panel and stops the renderer's LiveSplit event subscription. If the user connects LiveSplit and then turns the setting off, the server's `LiveSplitGateway` stays connected and `LiveSplit.handleRunEvent` keeps sending reset, start, split, and pause commands to LiveSplit.

## Direction

When a settings update changes `isLiveSplitEnabled` from true to false, call `LiveSplitGateway.disconnect` on the server.

## Open questions

- Does this belong in the settings save path, or in a subscription to settings changes owned by `LiveSplit`?

## Done when

- Turning the setting off disconnects the server from LiveSplit.
- `LiveSplit.handleRunEvent` sends no commands while the setting is off.

## Relevant code

- `apps/api/src/services/app-settings/app-settings-service.ts`
- `apps/api/src/services/live-split-gateway/live-split-gateway-service.ts` (`disconnect`)
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx`

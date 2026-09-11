import { LiveSplitControls } from "@/electron/renderer/components/live-split/live-split-controls.tsx";
import { LiveSplitStatus } from "@/electron/renderer/components/live-split/live-split-status.tsx";

export function LiveSplitPanel() {
  return (
    <section className="flex items-center justify-between gap-4 rounded-lg border p-4">
      <LiveSplitStatus />
      <LiveSplitControls />
    </section>
  );
}

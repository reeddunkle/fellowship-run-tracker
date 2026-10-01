import { Section } from "@frt/ui/composites/section.tsx";

import { LiveSplitControls } from "@/renderer/components/live-split/live-split-controls.tsx";
import { LiveSplitStatus } from "@/renderer/components/live-split/live-split-status.tsx";

export function LiveSplitPanel() {
  return (
    <Section className="flex items-center justify-between" variant="outline">
      <LiveSplitStatus />
      <LiveSplitControls />
    </Section>
  );
}

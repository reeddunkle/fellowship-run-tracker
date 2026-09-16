import { useCallback, useState } from "react";

export type DungeonRunMilestoneKey = string;

type DungeonRunMilestoneExpansionState = {
  readonly defaultIsExpanded: boolean;
  readonly overrides: ReadonlySet<DungeonRunMilestoneKey>;
};

export type DungeonRunDisplayState = {
  readonly collapseAllMilestones: () => void;
  readonly expandAllMilestones: () => void;
  readonly isMilestoneExpanded: (
    milestoneKey: DungeonRunMilestoneKey,
  ) => boolean;
  readonly setMilestoneExpanded: (
    milestoneKey: DungeonRunMilestoneKey,
    isExpanded: boolean,
  ) => void;
};

export function useDungeonRunMilestoneExpansion(): DungeonRunDisplayState {
  const [milestoneExpansionState, setMilestoneExpansionState] =
    useState<DungeonRunMilestoneExpansionState>({
      defaultIsExpanded: false,
      overrides: new Set(),
    });

  const expandAllMilestones = useCallback(() => {
    setMilestoneExpansionState({
      defaultIsExpanded: true,
      overrides: new Set(),
    });
  }, []);

  const collapseAllMilestones = useCallback(() => {
    setMilestoneExpansionState({
      defaultIsExpanded: false,
      overrides: new Set(),
    });
  }, []);

  const isMilestoneExpanded = useCallback(
    (milestoneKey: DungeonRunMilestoneKey) => {
      const isOverridden = milestoneExpansionState.overrides.has(milestoneKey);

      return isOverridden
        ? !milestoneExpansionState.defaultIsExpanded
        : milestoneExpansionState.defaultIsExpanded;
    },
    [milestoneExpansionState],
  );

  const setMilestoneExpanded = useCallback(
    (milestoneKey: DungeonRunMilestoneKey, isExpanded: boolean) => {
      setMilestoneExpansionState((currentState) => {
        const overrides = new Set(currentState.overrides);

        if (isExpanded === currentState.defaultIsExpanded) {
          overrides.delete(milestoneKey);
        } else {
          overrides.add(milestoneKey);
        }

        return {
          ...currentState,
          overrides,
        };
      });
    },
    [],
  );

  return {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  };
}

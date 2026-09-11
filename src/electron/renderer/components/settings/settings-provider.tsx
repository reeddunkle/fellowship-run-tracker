import { useRouter } from "@tanstack/react-router";
import * as E from "effect/Effect";
import {
  createContext,
  type ReactNode,
  startTransition,
  useActionState,
  useContext,
  useMemo,
  useOptimistic,
} from "react";

import * as appSettingsClient from "@/electron/renderer/api/app-settings/app-settings-client.ts";
import * as filesClient from "@/electron/renderer/api/electron-ipc/files/files-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";
import { RouterInvalidationError } from "@/errors/router-invalidation-error.ts";
import { type AppSettingsApiAppSettings } from "@/services/api/app-settings/app-settings-api-schema.ts";

type SettingsProviderProps = {
  readonly appSettings: AppSettingsApiAppSettings;
  readonly children: ReactNode;
};

type SaveSettingsActionState = {
  readonly appSettings: AppSettingsApiAppSettings | undefined;
  readonly error: unknown | undefined;
  readonly revision: number;
};

type SettingsStateContextValue = {
  readonly appSettings: AppSettingsApiAppSettings;
};

type SettingsActionContextValue = {
  readonly error: unknown | undefined;
  readonly getDirectoryPath: (file: File) => Promise<string>;
  readonly isSaving: boolean;
  readonly save: (appSettings: AppSettingsApiAppSettings) => void;
  readonly savedAppSettings: AppSettingsApiAppSettings | undefined;
  readonly saveRevision: number;
};

const INITIAL_SAVE_ACTION_STATE: SaveSettingsActionState = {
  appSettings: undefined,
  error: undefined,
  revision: 0,
};

const SettingsStateContext = createContext<
  SettingsStateContextValue | undefined
>(undefined);

const SettingsActionContext = createContext<
  SettingsActionContextValue | undefined
>(undefined);

function invalidateRouter(router: ReturnType<typeof useRouter>) {
  return E.tryPromise({
    catch: (cause) => {
      return new RouterInvalidationError({ cause });
    },
    try: () => {
      return router.invalidate({
        sync: true,
      });
    },
  });
}

function invalidateRouterSafely(router: ReturnType<typeof useRouter>) {
  return invalidateRouter(router).pipe(E.ignore);
}

export function SettingsProvider({
  appSettings,
  children,
}: SettingsProviderProps) {
  const router = useRouter();

  const [optimisticAppSettings, updateOptimisticAppSettings] =
    useOptimistic(appSettings);

  const [saveState, dispatchSave, isSaving] = useActionState(
    (
      previousState: SaveSettingsActionState,
      nextAppSettings: AppSettingsApiAppSettings,
    ): Promise<SaveSettingsActionState> => {
      const optimisticallyUpdateAppSettings = E.sync(() => {
        updateOptimisticAppSettings(nextAppSettings);
      });

      return optimisticallyUpdateAppSettings.pipe(
        E.andThen(appSettingsClient.putAppSettings(nextAppSettings)),
        E.tap(() => invalidateRouter(router)),
        E.map((savedAppSettings) => {
          return {
            appSettings: savedAppSettings,
            error: undefined,
            revision: previousState.revision + 1,
          };
        }),
        E.catch((error) => {
          return invalidateRouterSafely(router).pipe(
            E.as({
              appSettings: undefined,
              error,
              revision: previousState.revision,
            }),
          );
        }),
        browserRuntime.runPromise,
      );
    },
    INITIAL_SAVE_ACTION_STATE,
  );

  const actionContextValue = useMemo<SettingsActionContextValue>(() => {
    return {
      error: saveState.error,
      getDirectoryPath: (file) => {
        return E.runPromise(filesClient.getDirectoryPath(file));
      },
      isSaving,
      save: (nextAppSettings) => {
        startTransition(() => {
          dispatchSave(nextAppSettings);
        });
      },
      savedAppSettings: saveState.appSettings,
      saveRevision: saveState.revision,
    };
  }, [
    dispatchSave,
    isSaving,
    saveState.appSettings,
    saveState.error,
    saveState.revision,
  ]);

  const stateContextValue = useMemo<SettingsStateContextValue>(() => {
    return {
      appSettings: optimisticAppSettings,
    };
  }, [optimisticAppSettings]);

  return (
    <SettingsActionContext.Provider value={actionContextValue}>
      <SettingsStateContext.Provider value={stateContextValue}>
        {children}
      </SettingsStateContext.Provider>
    </SettingsActionContext.Provider>
  );
}

export function useSettingsState(): SettingsStateContextValue {
  const context = useContext(SettingsStateContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useSettingsState",
      providerName: "SettingsProvider",
    });
  }

  return context;
}

export function useSettingsActions(): SettingsActionContextValue {
  const context = useContext(SettingsActionContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useSettingsActions",
      providerName: "SettingsProvider",
    });
  }

  return context;
}

export function useAppSettings(): AppSettingsApiAppSettings {
  return useSettingsState().appSettings;
}

export type SettingsSaveStatus = {
  readonly error: unknown | undefined;
  readonly isSaving: boolean;
  readonly revision: number;
  readonly savedAppSettings: AppSettingsApiAppSettings | undefined;
};

export function useSettingsSaveStatus(): SettingsSaveStatus {
  const { error, isSaving, savedAppSettings, saveRevision } =
    useSettingsActions();

  return {
    error,
    isSaving,
    revision: saveRevision,
    savedAppSettings,
  };
}

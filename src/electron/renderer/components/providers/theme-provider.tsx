import { createContext, type ReactNode, useContext, useEffect } from "react";

import { useAppStore } from "@/electron/renderer/stores/app-state-store/use-app-store.ts";
import { type Theme } from "@/electron/storage/app-state/app-state-schema.ts";
import { ReactContextError } from "@/errors/react-context-error.ts";

type ThemeProviderProps = {
  readonly children: ReactNode;
};

type ThemeProviderState = {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined,
);

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { setTheme, theme } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (resolvedTheme: "dark" | "light") => {
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
    };

    if (theme !== "system") {
      applyTheme(theme);
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applySystemTheme = () => {
      applyTheme(mediaQuery.matches ? "dark" : "light");
    };

    applySystemTheme();

    mediaQuery.addEventListener("change", applySystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", applySystemTheme);
    };
  }, [theme]);

  return (
    <ThemeProviderContext.Provider
      value={{
        setTheme,
        theme,
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useTheme",
      providerName: "ThemeProvider",
    });
  }

  return context;
}

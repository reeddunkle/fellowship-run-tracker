import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

import { ReactContextError } from "@frt/ui/errors/react-context-error.ts";

type ResizeToContent = () => void;

type DetachedWindowContextValue = {
  readonly close: () => void;
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly portalContainer: HTMLElement | null;
  readonly resizeToContent: () => void;
  readonly setPortalContainer: (portalContainer: HTMLElement | null) => void;
  readonly setResizeToContent: (
    resizeToContent: ResizeToContent | null,
  ) => void;
};

const DetachedWindowContext = createContext<
  DetachedWindowContextValue | undefined
>(undefined);

type DetachedWindowProviderProps = {
  readonly children: ReactNode;
};

export function DetachedWindowProvider({
  children,
}: DetachedWindowProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );

  const resizeToContentRef = useRef<ResizeToContent | null>(null);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const resizeToContent = useCallback(() => {
    resizeToContentRef.current?.();
  }, []);

  const setResizeToContent = useCallback((value: ResizeToContent | null) => {
    resizeToContentRef.current = value;
  }, []);

  const contextValue = useMemo<DetachedWindowContextValue>(() => {
    return {
      close,
      isOpen,
      open,
      portalContainer,
      resizeToContent,
      setPortalContainer,
      setResizeToContent,
    };
  }, [
    close,
    isOpen,
    open,
    portalContainer,
    resizeToContent,
    setResizeToContent,
  ]);

  return (
    <DetachedWindowContext value={contextValue}>
      {children}
    </DetachedWindowContext>
  );
}

export function useDetachedWindow(): DetachedWindowContextValue {
  const context = useContext(DetachedWindowContext);

  if (context === undefined) {
    throw new ReactContextError({
      hookName: "useDetachedWindow",
      providerName: "DetachedWindowProvider",
    });
  }

  return context;
}

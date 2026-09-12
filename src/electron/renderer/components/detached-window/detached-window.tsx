import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import {
  type ReactNode,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import * as windowClient from "@/electron/renderer/api/electron-ipc/window/window-client.ts";
import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

function copyDocumentStyles({
  sourceDocument,
  targetDocument,
}: {
  readonly sourceDocument: Document;
  readonly targetDocument: Document;
}) {
  sourceDocument
    .querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], style',
    )
    .forEach((styleElement) => {
      targetDocument.head.append(styleElement.cloneNode(true));
    });
}

function configureDetachedDocument({
  sourceDocument,
  targetDocument,
}: {
  readonly sourceDocument: Document;
  readonly targetDocument: Document;
}) {
  targetDocument.documentElement.className =
    sourceDocument.documentElement.className;

  targetDocument.documentElement.classList.add(
    "[scrollbar-gutter:stable_both-edges]",
  );

  targetDocument.body.className = sourceDocument.body.className;
}

function createDetachedWindowContainer(document: Document) {
  const container = document.createElement("div");

  container.id = "root";

  /*
   * Keep the portal root sized to its contents rather than allowing the
   * normal block layout to stretch it to the detached viewport width.
   *
   * This keeps content measurements independent of the current window size.
   */
  container.style.width = "fit-content";

  document.body.append(container);

  return container;
}

const SCROLLBAR_GUTTER_WIDTH = 30;

function resizeDetachedWindowToContent({
  childContainer,
  childWindow,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
}) {
  return E.gen(function* () {
    const childDocument = childWindow.document;

    childDocument.documentElement.style.overflowY = "hidden";

    yield* windowClient.resizeWindowToContent({
      height: childContainer.scrollHeight,
      width: childContainer.scrollWidth + SCROLLBAR_GUTTER_WIDTH,
      window: childWindow,
    });

    yield* E.promise(() => {
      return new Promise<void>((resolve) => {
        childWindow.requestAnimationFrame(() => {
          childDocument.documentElement.style.overflowY = "auto";
          resolve();
        });
      });
    });
  });
}

function observeDetachedWindowContent({
  childContainer,
  childWindow,
  resizeToContent,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
  readonly resizeToContent: E.Effect<void, unknown>;
}) {
  let animationFrameId: number | undefined;

  const resizeObserver = new ResizeObserver(() => {
    if (animationFrameId !== undefined) {
      childWindow.cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = childWindow.requestAnimationFrame(() => {
      animationFrameId = undefined;

      browserRuntime.runFork(resizeToContent.pipe(E.catchCause(E.logError)));
    });
  });

  resizeObserver.observe(childContainer);

  return () => {
    if (animationFrameId !== undefined) {
      childWindow.cancelAnimationFrame(animationFrameId);
    }

    resizeObserver.unobserve(childContainer);
  };
}

type DetachedWindowProps = {
  readonly children: ReactNode;
  readonly onClose: () => void;
};

function DetachedWindow({ children, onClose }: DetachedWindowProps) {
  const childContainerRef = useRef<HTMLElement | null>(null);
  const { setPortalContainer, setResizeToContent } = useDetachedWindow();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const childWindow = window.open(
        "",
        "tracking-window",
        "width=1650,detachedWindow=true",
      );

      if (childWindow === null) {
        return () => {};
      }

      const childDocument = childWindow.document;

      copyDocumentStyles({
        sourceDocument: document,
        targetDocument: childDocument,
      });

      configureDetachedDocument({
        sourceDocument: document,
        targetDocument: childDocument,
      });

      const childContainer = createDetachedWindowContainer(childDocument);

      childContainerRef.current = childContainer;

      setPortalContainer(childDocument.body);

      const resizeToContent = resizeDetachedWindowToContent({
        childContainer,
        childWindow,
      });

      setResizeToContent(() => {
        browserRuntime.runFork(resizeToContent.pipe(E.catchCause(E.logError)));
      });

      let stopObservingContent: (() => void) | undefined;
      let initializationFrameId: number | undefined;
      let isCancelled = false;

      const clearReferences = () => {
        setPortalContainer(null);
        setResizeToContent(null);

        childContainerRef.current = null;
      };

      const handleClose = () => {
        stopObservingContent?.();
        clearReferences();

        onStoreChange();
        onClose();
      };

      childWindow.addEventListener("beforeunload", handleClose);

      // Publish the container to `useSyncExternalStore`.
      onStoreChange();

      const initializeWindow = E.gen(function* () {
        yield* E.promise(() => {
          return childDocument.fonts.ready;
        });

        if (isCancelled) {
          return;
        }

        yield* E.promise(() => {
          return new Promise<void>((resolve) => {
            initializationFrameId = childWindow.requestAnimationFrame(() => {
              resolve();
            });
          });
        });

        if (isCancelled) {
          return;
        }

        yield* resizeToContent;

        if (isCancelled) {
          return;
        }

        stopObservingContent = observeDetachedWindowContent({
          childContainer,
          childWindow,
          resizeToContent,
        });

        childWindow.electronAPI.showWindow();
      });

      const initializationFiber = browserRuntime.runFork(
        initializeWindow.pipe(E.catchCause(E.logError)),
      );

      return () => {
        isCancelled = true;

        browserRuntime.runFork(Fiber.interrupt(initializationFiber));

        if (initializationFrameId !== undefined) {
          childWindow.cancelAnimationFrame(initializationFrameId);
        }

        stopObservingContent?.();

        childWindow.removeEventListener("beforeunload", handleClose);

        clearReferences();

        if (!childWindow.closed) {
          childWindow.close();
        }
      };
    },
    [onClose, setPortalContainer, setResizeToContent],
  );

  const getSnapshot = useCallback(() => {
    return childContainerRef.current;
  }, []);

  const getServerSnapshot = useCallback(() => {
    return null;
  }, []);

  const childContainer = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (childContainer === null) {
    return null;
  }

  return createPortal(children, childContainer);
}

type ManagedDetachedWindowProps = {
  readonly children: ReactNode;
};

export function ManagedDetachedWindow({
  children,
}: ManagedDetachedWindowProps) {
  const { close, isOpen } = useDetachedWindow();

  if (!isOpen) {
    return null;
  }

  return (
    <DetachedWindow onClose={close}>
      <main className="mx-auto w-fit p-2 sidebar-gutter-auto">{children}</main>
    </DetachedWindow>
  );
}

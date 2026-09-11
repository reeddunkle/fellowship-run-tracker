import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import {
  type ReactNode,
  useCallback,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";

const WINDOW_HORIZONTAL_MARGIN = 32;
const WINDOW_VERTICAL_MARGIN = 32;

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

function resizeDetachedWindowToContent({
  childContainer,
  childWindow,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
}) {
  const childDocument = childWindow.document;

  // Prevent a transient scrollbar while the native window catches up
  // with the newly rendered content size.
  childDocument.documentElement.style.overflowY = "hidden";

  const contentHeight = childContainer.scrollHeight;
  const contentWidth = childContainer.scrollWidth;

  const windowChromeHeight = childWindow.outerHeight - childWindow.innerHeight;
  const windowChromeWidth = childWindow.outerWidth - childWindow.innerWidth;

  const scrollbarGutterWidth =
    childWindow.innerWidth - childWindow.document.documentElement.clientWidth;

  const maxHeight = childWindow.screen.availHeight - WINDOW_VERTICAL_MARGIN;
  const maxWidth = childWindow.screen.availWidth - WINDOW_HORIZONTAL_MARGIN;

  const desiredHeight = Math.ceil(contentHeight) + windowChromeHeight;

  const height = Math.min(desiredHeight, maxHeight);

  const width = Math.min(
    Math.ceil(contentWidth) + windowChromeWidth + scrollbarGutterWidth,
    maxWidth,
  );

  childWindow.resizeTo(width, height);

  childWindow.requestAnimationFrame(() => {
    childDocument.documentElement.style.overflowY =
      desiredHeight > maxHeight ? "auto" : "hidden";
  });
}

function observeDetachedWindowContent({
  childContainer,
  childWindow,
  resizeToContent,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
  readonly resizeToContent: () => void;
}) {
  let animationFrameId: number | undefined;

  const resizeObserver = new ResizeObserver(() => {
    if (animationFrameId !== undefined) {
      childWindow.cancelAnimationFrame(animationFrameId);
    }

    animationFrameId = childWindow.requestAnimationFrame(() => {
      animationFrameId = undefined;
      resizeToContent();
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
  const childWindowRef = useRef<Window | null>(null);
  const childContainerRef = useRef<HTMLElement | null>(null);
  const { setPortalContainer, setResizeToContent } = useDetachedWindow();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const childWindow = window.open(
        "",
        "tracking-window",
        "width=460,detachedWindow=true",
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

      childWindowRef.current = childWindow;
      childContainerRef.current = childContainer;

      setPortalContainer(childDocument.body);

      const resizeToContent = () => {
        resizeDetachedWindowToContent({
          childContainer,
          childWindow,
        });
      };

      setResizeToContent(resizeToContent);

      let stopObservingContent: (() => void) | undefined;
      let initializationFrameId: number | undefined;
      let isCancelled = false;

      const clearReferences = () => {
        setPortalContainer(null);
        setResizeToContent(null);

        childWindowRef.current = null;
        childContainerRef.current = null;
      };

      const handleClose = () => {
        stopObservingContent?.();
        clearReferences();

        onStoreChange();
        onClose();
      };

      childWindow.addEventListener("beforeunload", handleClose);

      // Publish the container to `useSyncExternalStore`
      onStoreChange();

      const initializeWindow = E.gen(function* () {
        yield* E.promise(() => {
          return childDocument.fonts.ready;
        });

        if (isCancelled) {
          return;
        }

        yield* E.sync(() => {
          initializationFrameId = childWindow.requestAnimationFrame(() => {
            if (isCancelled) {
              return;
            }

            resizeToContent();

            stopObservingContent = observeDetachedWindowContent({
              childContainer,
              childWindow,
              resizeToContent,
            });

            childWindow.electronAPI.showWindow();
          });
        });
      });

      const initializationFiber = E.runFork(initializeWindow);

      return () => {
        isCancelled = true;

        initializationFiber.pipe(Fiber.interrupt, E.runFork);

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

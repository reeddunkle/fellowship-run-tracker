import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { type ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";

import * as windowClient from "@/electron/renderer/api/electron-ipc/window/window-client.ts";
import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

const SCROLLBAR_GUTTER_WIDTH = 30;

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

function waitForAnimationFrame(window: Window) {
  return E.gen(function* () {
    const deferred = yield* Deferred.make<void>();

    yield* E.sync(() => {
      window.requestAnimationFrame(() => {
        browserRuntime.runFork(Deferred.succeed(deferred, undefined));
      });
    });

    return yield* Deferred.await(deferred);
  });
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
  return E.gen(function* () {
    const childDocument = childWindow.document;

    childDocument.documentElement.style.overflowY = "hidden";

    yield* windowClient.resizeWindowToContent({
      height: childContainer.scrollHeight,
      width: childContainer.scrollWidth + SCROLLBAR_GUTTER_WIDTH,
      window: childWindow,
    });

    yield* waitForAnimationFrame(childWindow);

    childDocument.documentElement.style.overflowY = "auto";
  });
}

type DetachedWindowResizeState = {
  animationFrameId: number | undefined;
  isActive: boolean;
};

function observeDetachedWindowContent({
  childContainer,
  childWindow,
  resizeToContent,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
  readonly resizeToContent: E.Effect<void, unknown>;
}) {
  return E.acquireRelease(
    E.sync(() => {
      const resizeState: DetachedWindowResizeState = {
        animationFrameId: undefined,
        isActive: true,
      };

      const resizeObserver = new ResizeObserver(() => {
        if (!resizeState.isActive) {
          return;
        }

        if (resizeState.animationFrameId !== undefined) {
          childWindow.cancelAnimationFrame(resizeState.animationFrameId);
        }

        resizeState.animationFrameId = childWindow.requestAnimationFrame(() => {
          resizeState.animationFrameId = undefined;

          if (!resizeState.isActive) {
            return;
          }

          browserRuntime.runFork(
            resizeToContent.pipe(E.catchCause(E.logError)),
          );
        });
      });

      resizeObserver.observe(childContainer);

      return {
        resizeObserver,
        resizeState,
      };
    }),
    ({ resizeObserver, resizeState }) => {
      return E.sync(() => {
        resizeState.isActive = false;

        if (resizeState.animationFrameId !== undefined) {
          childWindow.cancelAnimationFrame(resizeState.animationFrameId);
        }

        resizeObserver.disconnect();
      });
    },
  );
}

type DetachedWindowProps = {
  readonly children: ReactNode;
  readonly onClose: () => void;
};

function DetachedWindow({ children, onClose }: DetachedWindowProps) {
  const { portalContainer, setPortalContainer, setResizeToContent } =
    useDetachedWindow();

  const detachedWindowRef = useCallback(
    (_hostElement: HTMLDivElement) => {
      const childWindow = window.open(
        "",
        "tracking-window",
        "width=1650,detachedWindow=true",
      );

      if (childWindow === null) {
        return;
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

      setPortalContainer(childContainer);

      const resizeToContent = resizeDetachedWindowToContent({
        childContainer,
        childWindow,
      });

      setResizeToContent(() => {
        browserRuntime.runFork(resizeToContent.pipe(E.catchCause(E.logError)));
      });

      const runDetachedWindow = E.scoped(
        E.gen(function* () {
          yield* E.promise(() => {
            return childDocument.fonts.ready;
          });

          yield* waitForAnimationFrame(childWindow);

          yield* resizeToContent;

          yield* observeDetachedWindowContent({
            childContainer,
            childWindow,
            resizeToContent,
          });

          childWindow.electronAPI.showWindow();

          return yield* E.never;
        }),
      );

      const lifecycleFiber = browserRuntime.runFork(
        runDetachedWindow.pipe(E.catchCause(E.logError)),
      );

      const handleClose = () => {
        onClose();
      };

      childWindow.addEventListener("beforeunload", handleClose);

      return () => {
        childWindow.removeEventListener("beforeunload", handleClose);

        browserRuntime.runFork(Fiber.interrupt(lifecycleFiber));

        setPortalContainer(null);
        setResizeToContent(null);

        if (!childWindow.closed) {
          childWindow.close();
        }
      };
    },
    [onClose, setPortalContainer, setResizeToContent],
  );

  return (
    <>
      <div hidden ref={detachedWindowRef} />

      {portalContainer === null
        ? null
        : createPortal(children, portalContainer)}
    </>
  );
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

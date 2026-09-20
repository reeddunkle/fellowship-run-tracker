import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { type ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";

import * as windowClient from "@/electron/renderer/api/electron-ipc/window/window-client.ts";
import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

const SCROLLBAR_GUTTER_WIDTH = 30;

/**
 * `dungeon-run-table.tsx`'s label column is intentionally left unconstrained
 * (`table-layout: fixed` with no explicit `<col>` width) so it can absorb
 * extra width when the user manually widens the detached window. That makes
 * it undefined what its "natural" content width should be while measuring -
 * a fixed-layout table with an unconstrained column has no content-derived
 * intrinsic size to shrink-wrap to. `measureNaturalWidth` briefly pins it to
 * this default so the initial auto-size (and the "shrink to fit" button)
 * measure a well-defined, tight width instead of the whole available window.
 */
const DEFAULT_LABEL_COLUMN_WIDTH = "12.5rem";

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
   * Left at the default block width (fills the detached window's content
   * area) so that a manual OS-level resize actually hands the layout extra
   * horizontal space to use, instead of the layout permanently shrink-
   * wrapping to its own content. `resizeDetachedWindowToContent` briefly
   * overrides this to measure the content's natural/tight size.
   */

  document.body.append(container);

  return container;
}

/**
 * Measures the content's natural (shrink-to-fit) width by briefly forcing
 * the container to `max-content`, the dungeon-run table to `width: auto`
 * (its normal `w-full` otherwise always stretches it to fill the container,
 * regardless of how narrow its columns actually need to be), and the label
 * column to its default width, then reading `scrollWidth` before restoring
 * all three to their normal (window-filling / flexible) state. Reading a
 * layout property like `scrollWidth` forces a synchronous layout, so this
 * never paints the intermediate state.
 *
 * `max-content` (not `fit-content`) is deliberate: `fit-content` resolves to
 * `min(max-content, available-space)`, where "available space" is the
 * *current* (pre-resize) window width. When the content needs to grow wider
 * than the window currently is, `fit-content` clamps the measurement back
 * down to that current width, silently undermeasuring by however much the
 * content actually needs to grow. `max-content` ignores available space
 * entirely and always reports the content's true intrinsic width, which is
 * exactly what this measurement needs regardless of whether the window is
 * about to grow or shrink.
 */
function measureNaturalWidth(childContainer: HTMLElement) {
  const previousContainerWidth = childContainer.style.width;

  const table = childContainer.querySelector("table");
  const previousTableWidth = table?.style.width;

  const labelColumn = childContainer.querySelector<HTMLTableColElement>(
    "col[data-dungeon-run-label-col]",
  );
  const previousLabelColumnWidth = labelColumn?.style.width;

  childContainer.style.width = "max-content";

  if (table !== null) {
    table.style.width = "auto";
  }

  if (labelColumn !== null) {
    labelColumn.style.width = DEFAULT_LABEL_COLUMN_WIDTH;
  }

  const width = childContainer.scrollWidth;

  childContainer.style.width = previousContainerWidth;

  if (table !== null) {
    table.style.width = previousTableWidth ?? "";
  }

  if (labelColumn !== null) {
    labelColumn.style.width = previousLabelColumnWidth ?? "";
  }

  return width;
}

function resizeDetachedWindowToContent({
  childContainer,
  childWindow,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
}) {
  return E.gen(function* () {
    yield* waitForAnimationFrame(childWindow);

    const childDocument = childWindow.document;

    childDocument.documentElement.style.overflowY = "hidden";

    yield* windowClient.resizeWindowToContent({
      height: childContainer.scrollHeight,
      width: measureNaturalWidth(childContainer) + SCROLLBAR_GUTTER_WIDTH,
      window: childWindow,
    });

    yield* waitForAnimationFrame(childWindow);

    childDocument.documentElement.style.overflowY = "auto";
  });
}

/**
 * Re-measures height only (e.g. after a milestone expands/collapses),
 * resending the window's current width untouched so it never grows or
 * shrinks in response to content changes alone. Reads `innerWidth` (the
 * layout viewport, unaffected by the scrollbar-gutter reservation) rather
 * than `childContainer.clientWidth`, which excludes that reserved gutter and
 * so under-reports by a few pixels relative to what `resizeWindowToContent`
 * was actually set to - re-sending that smaller value would ratchet the
 * window narrower on every expand/collapse. `innerWidth` also naturally
 * reflects a manual OS-level resize, since it always matches the window's
 * actual current content width regardless of who last set it.
 */
function resizeDetachedWindowToContentHeight({
  childContainer,
  childWindow,
}: {
  readonly childContainer: HTMLElement;
  readonly childWindow: Window;
}) {
  return E.gen(function* () {
    yield* waitForAnimationFrame(childWindow);

    const childDocument = childWindow.document;

    childDocument.documentElement.style.overflowY = "hidden";

    yield* windowClient.resizeWindowToContent({
      height: childContainer.scrollHeight,
      width: childWindow.innerWidth,
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

      const scheduleResize = () => {
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
      };

      const resizeObserver = new ResizeObserver(scheduleResize);

      const mutationObserver = new MutationObserver(scheduleResize);

      resizeObserver.observe(childContainer);

      mutationObserver.observe(childContainer, {
        childList: true,
        subtree: true,
      });

      return {
        mutationObserver,
        resizeObserver,
        resizeState,
      };
    }),
    ({ mutationObserver, resizeObserver, resizeState }) => {
      return E.sync(() => {
        resizeState.isActive = false;

        if (resizeState.animationFrameId !== undefined) {
          childWindow.cancelAnimationFrame(resizeState.animationFrameId);
        }

        mutationObserver.disconnect();
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

      const resizeToContentHeight = resizeDetachedWindowToContentHeight({
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

          yield* resizeToContent;

          yield* observeDetachedWindowContent({
            childContainer,
            childWindow,
            resizeToContent: resizeToContentHeight,
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
      <main className="w-full p-2 sidebar-gutter-auto">{children}</main>
    </DetachedWindow>
  );
}

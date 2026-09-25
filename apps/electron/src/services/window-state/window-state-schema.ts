import * as Schema from "effect/Schema";

const WindowBoundsSchema = Schema.Struct({
  height: Schema.Finite,
  width: Schema.Finite,
  x: Schema.Finite,
  y: Schema.Finite,
});

export type WindowBounds = typeof WindowBoundsSchema.Type;

export const MainWindowStateSchema = Schema.Struct({
  bounds: WindowBoundsSchema,
  isMaximized: Schema.Boolean,
  zoomLevel: Schema.Finite,
});

export type MainWindowStateValue = typeof MainWindowStateSchema.Type;

export const DetachedWindowStateSchema = Schema.Struct({
  bounds: WindowBoundsSchema,
});

export type DetachedWindowStateValue = typeof DetachedWindowStateSchema.Type;

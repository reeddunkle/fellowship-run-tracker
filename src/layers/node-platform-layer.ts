import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as Layer from "effect/Layer";

export const NodeFileSystemLive = NodeFileSystem.layer;

export const NodePathLive = NodePath.layer;

export const NodePlatformLive = Layer.mergeAll(
  NodeFileSystemLive,
  NodePathLive,
);

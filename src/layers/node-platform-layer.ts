import { NodeFileSystem, NodePath } from "@effect/platform-node";
import * as NodeServices from "@effect/platform-node/NodeServices";

export const NodeFileSystemLive = NodeFileSystem.layer;

export const NodePathLive = NodePath.layer;

export const NodePlatformLive = NodeServices.layer;

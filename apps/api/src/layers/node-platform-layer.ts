import {
  NodeFileSystem,
  NodeHttpClient,
  NodePath,
} from "@effect/platform-node";
import * as NodeServices from "@effect/platform-node/NodeServices";

export const NodeFileSystemLayer = NodeFileSystem.layer;

export const NodePathLayer = NodePath.layer;

export const NodeHttpClientLayer = NodeHttpClient.layerNodeHttp;

export const NodePlatformLayer = NodeServices.layer;

import {
  NodeFileSystem,
  NodeHttpClient,
  NodePath,
} from "@effect/platform-node";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";

export const NodeFileSystemLive = NodeFileSystem.layer;

export const NodePathLive = NodePath.layer;

export const NodeHttpClientLive = NodeHttpClient.layerNodeHttp;

export const NodePlatformLive = NodeServices.layer;

export const NodePlatformWithHttpClientLive = Layer.mergeAll(
  NodePlatformLive,
  NodeHttpClientLive,
);

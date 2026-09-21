import {
  NodeFileSystem,
  NodeHttpClient,
  NodePath,
} from "@effect/platform-node";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";

export const NodeFileSystemLayer = NodeFileSystem.layer;

export const NodePathLayer = NodePath.layer;

export const NodeHttpClientLayer = NodeHttpClient.layerNodeHttp;

export const NodePlatformLayer = NodeServices.layer;

export const NodePlatformWithHttpClientLayer = Layer.mergeAll(
  NodePlatformLayer,
  NodeHttpClientLayer,
);

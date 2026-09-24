import { pathToFileURL } from "node:url";

import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { type ChildProcessHandle } from "effect/unstable/process/ChildProcessSpawner";

import { makePnpmCommand } from "@frt/api/helpers/make-pnpm-command.ts";
import { encodeJson } from "@frt/shared/util/common-schemas.ts";

import {
  type EffectTsGoLspError,
  EffectTsGoLspExecutableError,
  EffectTsGoLspProcessError,
  EffectTsGoLspProtocolError,
  EffectTsGoLspSourceFileError,
  EffectTsGoLspWorkspaceError,
} from "./errors/effect-tsgo-lsp-error.ts";
import {
  type JsonRpcMessage,
  JsonRpcMessageSchema,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./validation/lsp-client-schema.ts";

const WorkspaceTsConfigSchema = Schema.Struct({
  compilerOptions: Schema.Struct({
    paths: Schema.Struct({
      "@/*": Schema.Array(Schema.String),
    }),
  }),
  extends: Schema.String,
  include: Schema.Array(Schema.String),
});

const encodeWorkspaceTsConfig = Schema.encodeSync(
  Schema.fromJsonString(WorkspaceTsConfigSchema),
);

const JsonRpcMessageFromStringSchema =
  Schema.fromJsonString(JsonRpcMessageSchema);

const decodeJsonRpcMessage = Schema.decodeUnknownSync(
  JsonRpcMessageFromStringSchema,
);

type PendingRequest = Deferred.Deferred<JsonRpcResponse, EffectTsGoLspError>;

type LspRequest = {
  readonly method: string;
  readonly params?: unknown;
};

type LspNotification = {
  readonly method: string;
  readonly params?: unknown;
};

export type EffectTsGoLspService = {
  readonly getDocumentUri: (
    sourceFile: string,
  ) => E.Effect<string, EffectTsGoLspError>;

  readonly notify: (
    notification: LspNotification,
  ) => E.Effect<void, EffectTsGoLspError>;

  readonly request: (
    request: LspRequest,
  ) => E.Effect<JsonRpcResponse, EffectTsGoLspError>;
};

export class EffectTsGoLsp extends Context.Service<
  EffectTsGoLsp,
  EffectTsGoLspService
>()(
  "@frt/dev-scripts/generate-layer-graph/effect-tsgo-lsp-service/EffectTsGoLsp",
) {}

type ParsedMessage = {
  readonly message: JsonRpcMessage;
  readonly remaining: Buffer<ArrayBufferLike>;
};

type TsGoExecutableCommand = {
  readonly command: ChildProcess.Command;
  readonly platform: string;
  readonly platformDependency?: string | undefined;
};

type LspSetup = {
  readonly notify: EffectTsGoLspService["notify"];
  readonly projectRoot: string;
  readonly request: EffectTsGoLspService["request"];
  readonly workspaceDirectory: string;
};

function encodeMessage(message: unknown) {
  return encodeJson(message).pipe(
    E.map((body) => {
      const bodyBytes = Buffer.from(body, "utf8");

      const header = Buffer.from(
        `Content-Length: ${bodyBytes.byteLength}\r\n\r\n`,
        "utf8",
      );

      return Buffer.concat([header, bodyBytes]);
    }),
  );
}

function parseNextMessage(
  currentBuffer: Buffer<ArrayBufferLike>,
): ParsedMessage | undefined {
  const headerEnd = currentBuffer.indexOf("\r\n\r\n");

  if (headerEnd < 0) {
    return undefined;
  }

  const header = currentBuffer.subarray(0, headerEnd).toString("utf8");
  const contentLengthMatch = /Content-Length:\s*(\d+)/i.exec(header);

  if (contentLengthMatch === null) {
    throw new EffectTsGoLspProtocolError({
      header,
      operation: "ReadHeader",
    });
  }

  const contentLength = Number(contentLengthMatch[1]);
  const bodyStart = headerEnd + 4;
  const bodyEnd = bodyStart + contentLength;

  if (currentBuffer.length < bodyEnd) {
    return undefined;
  }

  const body = currentBuffer.subarray(bodyStart, bodyEnd).toString("utf8");

  return {
    message: decodeJsonRpcMessage(body),
    remaining: currentBuffer.subarray(bodyEnd),
  };
}

function isServerRequest(message: JsonRpcMessage): message is JsonRpcRequest {
  return "method" in message && "id" in message;
}

function isResponse(message: JsonRpcMessage): message is JsonRpcResponse {
  return "id" in message && !("method" in message);
}

function getTsGoPlatformDependency(): string | undefined {
  const platformDependencies: Readonly<Record<string, string>> = {
    "darwin:arm64": "@effect/tsgo-darwin-arm64",
    "darwin:x64": "@effect/tsgo-darwin-x64",
    "linux:arm": "@effect/tsgo-linux-arm",
    "linux:arm64": "@effect/tsgo-linux-arm64",
    "linux:x64": "@effect/tsgo-linux-x64",
    "win32:arm64": "@effect/tsgo-win32-arm64",
    "win32:x64": "@effect/tsgo-win32-x64",
  };

  return platformDependencies[`${process.platform}:${process.arch}`];
}

function getTsGoExecutableCommand({
  projectRoot,
}: {
  readonly projectRoot: string;
}): E.Effect<TsGoExecutableCommand> {
  return E.gen(function* () {
    const platform = `${process.platform}/${process.arch}`;
    const platformDependency = getTsGoPlatformDependency();

    const command = yield* makePnpmCommand(
      ["exec", "effect-tsgo", "get-exe-path"],
      {
        cwd: projectRoot,
      },
    );

    return {
      command,
      platform,
      platformDependency,
    };
  });
}

function getTsGoDependencyMessage({
  platform,
  platformDependency,
}: Pick<TsGoExecutableCommand, "platform" | "platformDependency">): string {
  if (platformDependency === undefined) {
    return `No known @effect/tsgo native dependency is configured for platform ${platform}.`;
  }

  return `Expected native dependency ${platformDependency} for platform ${platform}.`;
}

const make = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const setup = (): E.Effect<LspSetup, EffectTsGoLspError, Scope.Scope> => {
    return E.gen(function* () {
      const projectRoot = yield* fileSystem.realPath(".").pipe(
        E.mapError((cause) => {
          return new EffectTsGoLspWorkspaceError({
            cause,
            operation: "ResolveProjectRoot",
          });
        }),
      );

      const workspaceDirectory = yield* fileSystem
        .makeTempDirectoryScoped({
          directory: projectRoot,
          prefix: ".effect-tsgo-lsp-",
        })
        .pipe(
          E.mapError((cause) => {
            return new EffectTsGoLspWorkspaceError({
              cause,
              operation: "CreateWorkspace",
            });
          }),
        );

      const sourceDirectory = path.join(projectRoot, "src");
      const workspaceSourceDirectory = path.join(workspaceDirectory, "src");

      yield* fileSystem.copy(sourceDirectory, workspaceSourceDirectory).pipe(
        E.mapError((cause) => {
          return new EffectTsGoLspWorkspaceError({
            cause,
            operation: "CopySourceTree",
          });
        }),
      );

      const effectTsConfigPath = path.join(projectRoot, "tsconfig.effect.json");
      const workspaceTsConfigPath = path.join(
        workspaceDirectory,
        "tsconfig.json",
      );

      const workspaceTsConfig = encodeWorkspaceTsConfig({
        compilerOptions: {
          paths: {
            "@/*": ["./src/*"],
          },
        },
        extends: effectTsConfigPath,
        include: ["src/**/*.ts", "src/**/*.tsx"],
      });

      yield* fileSystem
        .writeFileString(workspaceTsConfigPath, `${workspaceTsConfig}\n`)
        .pipe(
          E.mapError((cause) => {
            return new EffectTsGoLspWorkspaceError({
              cause,
              operation: "WriteTsConfig",
            });
          }),
        );

      yield* E.logDebug("Created Effect TS-Go LSP workspace.", {
        projectRoot,
        workspaceDirectory,
      });

      const executableCommand = yield* getTsGoExecutableCommand({
        projectRoot,
      });

      const dependencyMessage = getTsGoDependencyMessage(executableCommand);

      const executablePath = yield* childProcessSpawner
        .string(executableCommand.command)
        .pipe(
          E.map((output) => {
            return output.trim();
          }),
          E.mapError((cause) => {
            return new EffectTsGoLspExecutableError({
              cause,
              description: dependencyMessage,
            });
          }),
        );

      const stdinQueue = yield* Queue.unbounded<Uint8Array>();

      const child: ChildProcessHandle = yield* childProcessSpawner
        .spawn(
          ChildProcess.make(executablePath, ["--lsp", "--stdio"], {
            cwd: workspaceDirectory,
            stderr: "inherit",
            stdin: Stream.fromQueue(stdinQueue),
          }),
        )
        .pipe(
          E.mapError((cause) => {
            return new EffectTsGoLspProcessError({
              cause,
              description: dependencyMessage,
              operation: "Launch",
            });
          }),
        );

      yield* E.logDebug("Started Effect TS-Go LSP process.", {
        executablePath,
        pid: child.pid,
        platform: executableCommand.platform,
        platformDependency: executableCommand.platformDependency,
        workspaceDirectory,
      });

      const nextRequestId = yield* Ref.make(1);
      const pendingRequests = new Map<number, PendingRequest>();

      let responseBuffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);

      const sendMessage = (message: unknown) => {
        return encodeMessage(message).pipe(
          E.flatMap((encodedMessage) => {
            return Queue.offer(stdinQueue, encodedMessage);
          }),
          E.asVoid,
          E.mapError((cause) => {
            return new EffectTsGoLspProtocolError({
              cause,
              operation: "WriteMessage",
            });
          }),
        );
      };

      const failPendingRequests = (error: EffectTsGoLspError) => {
        return E.gen(function* () {
          const currentPendingRequests = [...pendingRequests.values()];

          pendingRequests.clear();

          yield* E.forEach(
            currentPendingRequests,
            (pendingRequest) => {
              return Deferred.fail(pendingRequest, error).pipe(E.asVoid);
            },
            {
              discard: true,
            },
          );
        });
      };

      const respondToServerRequest = (serverRequest: JsonRpcRequest) => {
        return sendMessage({
          id: serverRequest.id,
          jsonrpc: "2.0",
          result: null,
        });
      };

      const resolvePendingRequest = (response: JsonRpcResponse) => {
        if (typeof response.id !== "number") {
          return E.void;
        }

        const pendingRequest = pendingRequests.get(response.id);

        if (pendingRequest === undefined) {
          return E.void;
        }

        pendingRequests.delete(response.id);

        return Deferred.succeed(pendingRequest, response).pipe(E.asVoid);
      };

      const handleMessage = (message: JsonRpcMessage) => {
        if (isServerRequest(message)) {
          return respondToServerRequest(message);
        }

        if (isResponse(message)) {
          return resolvePendingRequest(message);
        }

        return E.void;
      };

      const handleData = (
        chunk: Uint8Array,
      ): E.Effect<void, EffectTsGoLspProtocolError> => {
        return E.gen(function* () {
          responseBuffer = Buffer.concat([responseBuffer, Buffer.from(chunk)]);

          const messages: Array<JsonRpcMessage> = [];

          yield* E.try({
            catch: (cause) => {
              return new EffectTsGoLspProtocolError({
                cause,
                operation: "ParseMessage",
              });
            },
            try: () => {
              while (true) {
                const parsedMessage = parseNextMessage(responseBuffer);

                if (parsedMessage === undefined) {
                  return;
                }

                responseBuffer = parsedMessage.remaining;
                messages.push(parsedMessage.message);
              }
            },
          });

          yield* E.forEach(
            messages,
            (parsedMessage) => {
              return handleMessage(parsedMessage);
            },
            {
              discard: true,
            },
          );
        });
      };

      yield* child.stdout.pipe(
        Stream.runForEach((chunk) => {
          return handleData(chunk);
        }),
        E.catch((cause) => {
          const error = new EffectTsGoLspProcessError({
            cause,
            operation: "ReadOutput",
          });

          return E.gen(function* () {
            yield* E.logError(error.message, {
              cause,
            });

            yield* failPendingRequests(error);
          });
        }),
        E.forkScoped,
      );

      yield* child.exitCode.pipe(
        E.flatMap((exitCode) => {
          return failPendingRequests(
            new EffectTsGoLspProcessError({
              exitCode,
              operation: "Exit",
            }),
          );
        }),
        E.catch((cause) => {
          return failPendingRequests(
            new EffectTsGoLspProcessError({
              cause,
              operation: "WaitForExit",
            }),
          );
        }),
        E.forkScoped,
      );

      const request: EffectTsGoLspService["request"] = (lspRequest) => {
        return E.gen(function* () {
          const requestId = yield* Ref.getAndUpdate(
            nextRequestId,
            (currentRequestId) => {
              return currentRequestId + 1;
            },
          );

          const responseDeferred = yield* Deferred.make<
            JsonRpcResponse,
            EffectTsGoLspError
          >();

          pendingRequests.set(requestId, responseDeferred);

          yield* sendMessage({
            id: requestId,
            jsonrpc: "2.0",
            method: lspRequest.method,
            params: lspRequest.params,
          }).pipe(
            E.tapError(() => {
              return E.sync(() => {
                pendingRequests.delete(requestId);
              });
            }),
          );

          return yield* Deferred.await(responseDeferred).pipe(
            E.ensuring(
              E.sync(() => {
                pendingRequests.delete(requestId);
              }),
            ),
          );
        });
      };

      const notify: EffectTsGoLspService["notify"] = (notification) => {
        return sendMessage({
          jsonrpc: "2.0",
          method: notification.method,
          params: notification.params,
        });
      };

      const rootUri = pathToFileURL(workspaceDirectory).href;

      yield* request({
        method: "initialize",
        params: {
          capabilities: {
            textDocument: {
              documentSymbol: {
                hierarchicalDocumentSymbolSupport: true,
              },
              hover: {
                contentFormat: ["markdown", "plaintext"],
              },
            },
          },
          processId: process.pid,
          rootUri,
        },
      });

      yield* notify({
        method: "initialized",
        params: {},
      });

      yield* E.logInfo("Initialized Effect TS-Go LSP.", {
        rootUri,
      });

      const shutdown = () => {
        return E.gen(function* () {
          yield* E.logDebug("Shutting down Effect TS-Go LSP.");

          yield* request({
            method: "shutdown",
          }).pipe(E.timeout("2 seconds"));

          yield* notify({
            method: "exit",
          });

          yield* E.logDebug("Requested graceful Effect TS-Go LSP exit.");
        }).pipe(
          E.catch((cause) => {
            return E.logWarning(
              "Failed to gracefully shut down the Effect TS-Go LSP.",
              {
                cause,
              },
            );
          }),
        );
      };

      yield* E.addFinalizer(() => {
        return shutdown();
      });

      return {
        notify,
        projectRoot,
        request,
        workspaceDirectory,
      } satisfies LspSetup;
    });
  };

  const lspSetup = yield* setup();

  const getDocumentUri: EffectTsGoLspService["getDocumentUri"] = (
    sourceFile,
  ) => {
    return E.gen(function* () {
      const absoluteSourceFile = path.resolve(lspSetup.projectRoot, sourceFile);

      const relativeSourceFile = path.relative(
        lspSetup.projectRoot,
        absoluteSourceFile,
      );

      if (
        relativeSourceFile === ".." ||
        relativeSourceFile.startsWith(`..${path.sep}`)
      ) {
        return yield* new EffectTsGoLspSourceFileError({
          sourceFile,
        });
      }

      return pathToFileURL(
        path.join(lspSetup.workspaceDirectory, relativeSourceFile),
      ).href;
    });
  };

  return {
    getDocumentUri,
    notify: lspSetup.notify,
    request: lspSetup.request,
  } satisfies EffectTsGoLspService;
});

export const EffectTsGoLspLive = Layer.effect(EffectTsGoLsp, make);

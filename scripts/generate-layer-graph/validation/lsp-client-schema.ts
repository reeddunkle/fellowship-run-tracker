import * as Schema from "effect/Schema";

export const JsonRpcIdSchema = Schema.Union([Schema.Finite, Schema.String]);

export const JsonRpcRequestSchema = Schema.Struct({
  id: JsonRpcIdSchema,
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
  params: Schema.optionalKey(Schema.Unknown),
});

export type JsonRpcRequest = typeof JsonRpcRequestSchema.Type;

export const JsonRpcNotificationSchema = Schema.Struct({
  jsonrpc: Schema.Literal("2.0"),
  method: Schema.String,
  params: Schema.optionalKey(Schema.Unknown),
});

export type JsonRpcNotification = typeof JsonRpcNotificationSchema.Type;

export const JsonRpcResponseSchema = Schema.Struct({
  error: Schema.optionalKey(Schema.Unknown),
  id: JsonRpcIdSchema,
  jsonrpc: Schema.Literal("2.0"),
  result: Schema.optionalKey(Schema.Unknown),
});

export type JsonRpcResponse = typeof JsonRpcResponseSchema.Type;

export const JsonRpcMessageSchema = Schema.Union([
  JsonRpcRequestSchema,
  JsonRpcNotificationSchema,
  JsonRpcResponseSchema,
]);

export type JsonRpcMessage = typeof JsonRpcMessageSchema.Type;

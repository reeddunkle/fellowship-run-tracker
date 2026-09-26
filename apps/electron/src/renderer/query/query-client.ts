import "./react-query.ts";

import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import {
  isUnexpectedRendererError,
  logRendererError,
} from "@/renderer/logging/renderer-error-logging.ts";

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isUnexpectedRendererError(error)) {
        logRendererError("A renderer mutation failed unexpectedly.", error);
      }
    },
  }),
  queryCache: new QueryCache({
    onError: (error) => {
      if (isUnexpectedRendererError(error)) {
        logRendererError("A renderer query failed unexpectedly.", error);
      }
    },
  }),
});

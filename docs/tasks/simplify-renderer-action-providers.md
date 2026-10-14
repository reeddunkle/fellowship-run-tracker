# Simplify renderer action providers

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 8. Strength: worth exploring.

## Problem

The tracking and LiveSplit providers repeat the same pattern for every action:

1. `useActionState(() => client.x().pipe(E.as({ error: undefined }), E.catch((e) => E.succeed({ error: e })), browserRuntime.runPromise))`
2. a `startTransition` wrapper
3. a `useMemo` context value with a six-item dependency list
4. a `ReactContextError` guard of about 20 lines
5. two selector hooks, `useXActions` and `useXActionState`, that only re-spread the context

Each provider is 185 to 206 lines for two client calls. Their interfaces are as large as their bodies. The providers mostly exist to share one error value between sibling components. Neither provider has tests.

## Direction

Replace the pattern with one hook that runs an Effect and exposes its pending and error state, or use react-query's `useMutation` the way `app-state-mutations.ts` does. Then check whether each provider still needs a context.

## Open questions

- A custom hook or `useMutation`? `useMutation` is already in use, but it adds react-query to code that doesn't otherwise need it.
- Do sibling components really need to share one error value, or can each component own its own?
- Should [move-settings-to-react-query.md](move-settings-to-react-query.md) use the same approach for its mutations?

## Done when

- Tracking and LiveSplit actions use one shared approach.
- That approach has its own tests, without a provider tree.

## Relevant code

- `apps/electron/src/renderer/stores/tracking/tracking-provider.tsx`
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx`
- `apps/electron/src/renderer/api/app-state/app-state-mutations.ts`

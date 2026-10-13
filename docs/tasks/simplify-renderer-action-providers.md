# Simplify renderer action providers and settings

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), candidate 8. Strength: worth exploring.

## Problem

### Action providers

The tracking, LiveSplit, and settings providers each repeat the same pattern for every action:

1. `useActionState(() => client.x().pipe(E.as({ error: undefined }), E.catch((e) => E.succeed({ error: e })), browserRuntime.runPromise))`
2. a `startTransition` wrapper
3. a `useMemo` context value with a six-item dependency list
4. a `ReactContextError` guard of about 20 lines
5. two selector hooks, `useXActions` and `useXActionState`, that only re-spread the context

The tracking and LiveSplit providers are 185-206 lines each for two client calls apiece. Their interfaces are as wide as their bodies. The providers mostly exist to share one error value between sibling components.

### Dead context in DungeonRunProvider

`DungeonRunProvider` puts hardcoded values in its context: `eventConnectionState: DISCONNECTED`, `history: null`, `runState: null`, and `comparisonGroup`. `useDungeonRunContext` reads only the four milestone-expansion fields. The real server state comes from `useDungeonRunServerState`, which reads a second context, `DungeonRunSourcesContext`, and calls `useDungeonRunComparisonGroup()` again. The value for that second context is a new object on every render.

### Settings

The root route loader loads settings, and the app changes them through `useActionState`, `useOptimistic`, and `router.invalidate()`. Every other server value uses react-query, which goes against the project's reactive `useQuery` convention.

`settings-editor.tsx` (455 lines) hand-writes six `form.Field` blocks with `field.state.meta.errors.length > 0 ? <FieldError /> : null`. `AppTextField` already exists in `components/form/fields/text-field.tsx`, and `FieldError` already returns null when there are no errors. The client-secret field has about 90 lines of branching.

## Proposed change

- Add a `useEffectAction(effectFn)` hook that returns `{ run, error, isPending }`, or use react-query's `useMutation` the way `app-state-mutations.ts` does. Then check whether each provider still needs a context.
- Delete the `DungeonRunState` part of the context. Keep one context with the event store, the tracking event store, and the expansion state.
- Load and save settings through a query and a mutation.
- Use `AppTextField` and `AppNumberField` in the settings editor. Extract the client-secret field and the "Test connection" section into their own components.

## Tests

The action hook is tested once, without a provider tree. The client-secret field's state logic can be unit tested. The three `tests/browser/dungeon-run/*` suites stop depending on misleading default values. Today the settings editor, the settings provider, and the tracking and LiveSplit providers have no tests.

## Relevant code

- `apps/electron/src/renderer/stores/tracking/tracking-provider.tsx` (lines 64-127)
- `apps/electron/src/renderer/stores/live-split/live-split-provider.tsx` (lines 73-129)
- `apps/electron/src/renderer/stores/dungeon-run/dungeon-run-provider.tsx` (lines 125-146, 189, 240-251)
- `apps/electron/src/renderer/components/providers/settings-provider.tsx`
- `apps/electron/src/renderer/components/settings/settings-editor.tsx`
- `apps/electron/src/renderer/router/routes/__root.tsx`
- `apps/electron/src/renderer/components/form/fields/text-field.tsx`
- `packages/ui/src/primitives/field.tsx` (line 215)

# Load and save settings through react-query

Source: [architecture review, 2026-10-13](../architecture-reviews/architecture-review-20261013-170319.html), split out of candidate 8. Strength: worth exploring.

## Problem

The root route loader loads settings, and the app changes them through `useActionState`, `useOptimistic`, and `router.invalidate()`. Every other server value uses react-query, which goes against the project's reactive `useQuery` convention.

`settings-editor.tsx` (455 lines) hand-writes six `form.Field` blocks. Five of them wrap `FieldError` in `field.state.meta.errors.length > 0 ? ... : null`, but `FieldError` already returns null when there are no errors. `AppTextField` already exists in `components/form/fields/text-field.tsx`. The client-secret field has about 90 lines of branching.

Neither the settings editor nor the settings provider has tests.

## Direction

Load settings with a query and save them with a mutation, like other server values. Build the editor from the shared form field components, and move the client-secret field and the "Test connection" section into their own components.

## Open questions

- Does anything need settings before the first render, which the route loader guarantees today?
- Should saving stay optimistic?
- Does the settings provider still need to exist once settings come from a query?

## Done when

- Settings load and save through react-query.
- The settings editor uses the shared form field components.
- The client-secret field has its own tests.

## Relevant code

- `apps/electron/src/renderer/router/routes/__root.tsx`
- `apps/electron/src/renderer/components/providers/settings-provider.tsx`
- `apps/electron/src/renderer/components/settings/settings-editor.tsx`
- `apps/electron/src/renderer/components/form/fields/text-field.tsx`
- `packages/ui/src/primitives/field.tsx` (`FieldError`)

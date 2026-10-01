# @frt/ui

The app's styled UI package. It holds the design tokens, the primitive components, and the composites the renderer builds pages from. Feature code in `apps/electron/src/renderer` imports from here and adds layout, data, and behavior. It does not add looks.

The primitives started as shadcn/ui components, but this package does not keep style parity with upstream. Restyle them freely. When upstream fixes behavior (accessibility, keyboard handling, a Base UI API change), apply the fix by hand.

## Layout

```
src/
  styles/       tokens and shared class constants
  primitives/   generic components (Button, Card, Table, ...)
  composites/   components assembled from primitives for this app
  errors/       error classes shared by the components
```

### styles/

- `theme.css` declares every token: colors, radius, the timing table widths, `text-2xs`, and the dark mode values. It also registers `src/` as a Tailwind source.
- `globals.css` imports Tailwind, `tw-animate-css`, `shadcn/tailwind.css`, and the theme. The app stylesheet imports this file and adds fonts.
- `control.ts`, `text.ts`, `surface.ts`, and `menu.ts` hold class strings and cva definitions that more than one primitive uses, such as the focus ring, control heights, label text, and popup surfaces.
- `class-names.ts` exports `cn`.

### primitives/

Primitives know nothing about the app. Each one owns its colors, spacing, typography, and shape through cva variants. Variant names follow the shadcn vocabulary: `variant`, `size`, and a few equally generic axes such as `shape` and `align`.

### composites/

Composites give each repeated app pattern one name: `PageShell`, `Section`, `StatList`, `StatusText`, `EmptyState`, `SplitDelta`, `TimingTable`, `SidebarCard`, and others. A composite may know about the domain (split deltas, timing columns), but it takes plain values. `SplitDelta` takes a formatted string and a `status`. It does not import formatters or app state.

## Where a style goes

When a screen needs something to look different, work down this list and stop at the first option that fits.

1. Use an existing variant on a primitive or composite.
2. Add a generic variant to the primitive, such as `variant="success"` on Button. The name has to make sense outside this app.
3. Add a composite when the pattern has a name in the app, such as "time cell" or "page header".
4. Export a cva definition and apply it to a plain HTML element, for example `buttonVariants()` on a router `Link`.

Do not add props that name one screen's situation, such as `width="time"` or `state="unsaved"`. That meaning belongs in a composite.

On a primitive or composite, `className` may only carry layout classes: margin, width and height, flex and grid placement, position, and overflow. Colors, padding, gap, typography, borders, and shadows come from variants. Plain HTML elements in feature code can use any token-based class.

Use tokens instead of raw values. Write `text-success`, not `text-green-600`. Write `w-time-column`, not `w-[10ch]`. If no token fits, add one to `theme.css`.

## Lint rules

`pnpm lint` runs `@shadcn/lint` through oxlint with `--deny-warnings`, so any warning fails `pnpm lint` and `pnpm check`. The rules are:

- `no-restyle` reports non-layout classes on components from `@frt/ui`.
- `no-raw-colors` reports palette colors and colors the theme does not declare.
- `no-arbitrary-values` reports bracket values like `p-[13px]`. Arbitrary variants like `data-[state=open]:` are allowed.
- `no-inline-styles` reports `style` props, except CSS custom properties.
- `no-unknown-classes` asks Tailwind whether each class generates CSS.
- `require-static-classes` reports `className` values the linter cannot read on components from `@frt/ui`, such as template literals or a `className` prop passed through from a parent.

`primitives/` and `styles/` turn off `no-restyle`, `no-arbitrary-values`, and `require-static-classes`, because they define the styles the rules protect. `composites/` follows the same rules as feature code, so a composite cannot restyle a primitive either.

When a component needs a parent's layout class, wrap it in a plain `div` instead of forwarding `className`.

## Adding a shadcn component

Run the add script from the repo root:

```bash
pnpm ui:add <component>
```

The script runs the shadcn CLI against `apps/electron`, which writes the new file to `packages/ui/src/primitives/`. The CLI makes three changes you need to undo:

- It imports `cn` from a `cn` npm package. Change the import to `@frt/ui/styles/class-names.ts`.
- It adds `cn` to `apps/electron/package.json`. Remove it.
- It re-sorts `apps/electron/package.json`. Restore the original order.

Then run `pnpm biome:fix`, and switch any class strings the new file repeats from `styles/` to the shared constants.

Then audit the Shadcn React logic from the new file(s) and ensure they are up to the standards and patterns of the rest of the app.

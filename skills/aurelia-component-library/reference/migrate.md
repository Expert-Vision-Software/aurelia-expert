# Migrate — extract existing components into the library

Lift already-written components out of feature folders and assemble them into `shared/components/ui/` as token-driven library elements. The procedure is conservative: every step has a reversible exit, and a hard gate sends v1 source to `aurelia-migration` before any structural move.

## Gate — is the source v1 or v2?

Scan the candidate files for v1-only patterns (the "lift table" from `aurelia-migration/reference/v1-removals.md`):

- `PLATFORM.moduleName(...)` — *removed in v2.*
- `configureRouter(config, router)` — replaced by `@route`.
- `<router-view>` — replaced by `<au-viewport>`.
- `<compose>` — replaced by `<au-compose>`.
- `@inject(...)` decorator on constructors — replaced by `resolve()` defaults.
- `.delegate` on a custom event (e.g. `save.delegate="..."` where `save` is custom) — throws AUR0713 at compile time.
- `activate()` / `deactivate()` lifecycle methods — renamed to `canLoad` / `loading` / `canUnload` / `unloading`.

If any of these appear, **stop this procedure**. Branch through `aurelia-migration` first (lead the prompt with `lift`), run the v1-removals table against every candidate file, and only return here when the source is v2-current. Tokenizing v1 code in place defeats the lift.

## Step 1 — Inventory

List every custom element that any feature folder has written. The candidates are `@customElement` registrations under `src/features/*/components/*` and any ad-hoc component under `src/components/`. For each, capture:

- Tag name (must become `ui-<thing>` if it ends up in the library).
- Class name.
- `@bindable` surface.
- Whether the template mentions any business entity (`Order`, `Customer`, `Billing`, etc.).

## Step 2 — Classify

For each candidate, apply the `shared/` admission rule from `aurelia-largespa/reference/directory-layout.md`:

- **No business vocabulary, reusable across features** → goes to the library (`ui-button`, `ui-card`, `ui-icon`, generic `ui-loader`, etc.).
- **Mentions a business entity, even once** → stays in the owning feature under `features/<slice>/components/`. It is not a library element.

When in doubt, the deciding question is: *if I removed all features from this app, would this component still make sense to a downstream app?* Yes → library. No → feature.

For candidates that fail the classifier, stop processing them and move on. For candidates that pass, continue.

## Step 3 — Move and rename

For each library-bound candidate:

1. **Folder:** rename `src/features/<slice>/components/<thing>/` to `src/shared/components/ui/ui-<thing>/` (use the kebab form even if the source is camelCase or PascalCase).
2. **Tag:** rename the `@customElement(...)` arg to `ui-<thing>`. Update every consumer's element name accordingly.
3. **Class:** PascalCase the class into `Ui<Thing>` (`UiButton`, `UiCard`). Update every `import` site.
4. **File basenames:** align with the new tag (`ui-button.ts`, `ui-button.html`).

The pairing convention (no `template:` field) and the import-disciplines (`import type` for unions, regular import for the class) carry over unchanged.

## Step 4 — Switch projection to `<au-slot>`

If the existing template uses bare `<slot>` without `shadowOptions`, swap it for `<au-slot>`. The Light DOM cascade is the library's default; this is also the moment to delete any local styles the candidate had that depended on shadow encapsulation. Bare `<slot>` in Light DOM without `shadowOptions` throws AUR0717 (the table in `aurelia-migration/reference/debugging.md`).

```html
<!-- before -->
<slot></slot>

<!-- after -->
<au-slot></au-slot>
```

## Step 5 — Switch custom events to `.trigger`

Audit every binding on a custom event in the template — `open.delegate`, `save.delegate`, etc. — and rewrite to `.trigger`. The component class's bound method or `@bindable` callback becomes a custom event argument; consumers in pages and features update to `.trigger` too.

```html
<!-- before -->
<ui-modal open.delegate="handleOpen()">...</ui-modal>

<!-- after -->
<ui-modal open.trigger="handleOpen($event)">...</ui-modal>
```

This applies to the component's own *emitted* events as well — replace any `new CustomEvent('open')` referencing `.delegate` with the `Event` constructor + `.trigger`-bound consumers.

## Step 6 — Convert class lists to a computed `classNames`

If the source template interpolates `class="ui-button--${variant}"`, switch to a view-model getter:

```typescript
public get classNames(): string {
  return [
    'ui-button',
    `ui-button--${this.variant}`,
    `ui-button--${this.size}`,
    this.block ? 'ui-button--block' : '',
  ]
    .filter((token: string) => token.length > 0)
    .join(' ');
}
```

```html
<button class.bind="classNames">...</button>
```

Combined `class="static"` + `class.bind="..."` does not work; emit the full string from the getter.

## Step 7 — Convert dynamic CSS to `.style` binding

If the template uses inline `style="width: ${pct}%"` (or any `0`/`false`/`''`-prone interpolation), switch to per-property `.style` binding:

```html
<!-- before -->
<div style="width: ${pct}%"></div>
<div style="opacity: ${isVisible ? 1 : 0}"></div>

<!-- after -->
<div width.style="pct + '%'"></div>
<div opacity.style="isVisible ? '1' : '0'"></div>
```

For multiple style props on one element, use the object form: `<div style.bind="{ width: pct + '%', backgroundColor: theme }">`.

## Step 8 — Tokenize

Audit the candidate's `.css` (if any) for raw visual values:

- Hex codes (`#2563eb`) → `var(--au-color-action)` (or whichever the closest `tokens.css` token is).
- Raw spacings (`8px`, `1rem`, `12px`) → the nearest `--au-space-n` token. If none fits, add a new token to `tokens.css` first, then consume it.
- Raw radii (`4px`, `0.5rem`) → the nearest `--au-radius-*` token.
- Raw durations (`200ms`, `0.2s`) → the nearest `--au-duration-*` token.

If a value is *unique to this component* and not part of the design language, the right move is to **add a token** (one source of truth wins) rather than keep it inline. The acceptance bar: no raw `#hex`, `rem`, `ms`, `px`, or `cubic-bezier(...)` literal survives in a library file.

If `tokens.css` doesn't exist yet, follow [greenfield.md](../greenfield.md) steps 1–2 first, then return.

## Step 9 — Switch bindable modes for read-only props

Read-only bindables (`disabled`, `current`, `label`) move from default `.bind` to `.to-view`:

```html
<button disabled.to-view="disabled" type.to-view="type">...</button>
```

Default `.bind` is reserved for form-bound inputs (text, textarea, select). See `aurelia-foundation/reference/components.md` binding-mode table.

## Step 10 — Register globally

Add the new `Ui*` to `src/shared/components/ui/index.ts` (runtime export) and to `src/shared/index.ts#register()`:

```typescript
// src/shared/components/ui/index.ts
export { UiButton } from './ui-button/ui-button';
export type { ButtonVariant, ButtonSize } from './ui-button/ui-button';
```

```typescript
// src/shared/index.ts (inside Shared.register)
import { UiButton } from './components/ui';

container.register(
  UiButton,
  Registration.singleton(IThemeService, ThemeService),
);

export { UiButton } from './components/ui';
export type { ButtonVariant, ButtonSize } from './components/ui';
```

Because globals are ambient, no consumer needs a `dependencies` array to use them.

## Step 11 — Update every import site

In every page and feature that referenced the old path, retarget the import:

```typescript
// before
import { PrimaryButton } from '../features/marketing/components/primary-button';

// after
import { UiButton } from '../../shared/components/ui';
```

…and replace the template usage from `<primary-button>` to `<ui-button>` (or wherever the renamed tag ended up).

## Step 12 — Delete the old location

Once every consumer renders the moved component cleanly under the library tag, delete the source folder from the feature. Run the full test suite, then `bun run build`. The bundle should be *smaller* than before — the candidate no longer ships per feature; one library element serves every feature.

**Completion criterion:** `grep -R "<old-tag-name>" src` returns zero hits and the app boots; the move is invisible to the user.

## Review checklist

- Every library-bound candidate went through the v1 gate first; no v1 syntax survives in the library.
- Every library element's raw visual values resolve to `var(--au-*)`; `tokens.css` is the only place to add a new token.
- Every dynamic CSS site uses `.style` binding, never inline interpolation.
- Every custom event uses `.trigger`, every read-only prop uses `.to-view`.
- Every `Ui*` is exported from the `ui/index.ts` barrel AND registered in `shared/index.ts#register()`.
- The total bundle size decreased compared to the pre-migration baseline.

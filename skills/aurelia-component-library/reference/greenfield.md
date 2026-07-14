# Greenfield — assemble the library from scratch

Deploy the canonical structure into a project that doesn't have a component library yet. The procedure is a file-creation checklist with one completion criterion per step; a step that compiles but doesn't run a smoke test isn't done.

## Preconditions

- An Aurelia 2 + Vite + TypeScript project (see `aurelia-foundation/reference/quickstart.md`).
- Tailwind v4 installed:

  ```bash
  bun add -d tailwindcss @tailwindcss/vite
  ```

  The exact install command depends on the bundler; the canonical integration is Tailwind v4's CSS-first config (`@import "tailwindcss";`) wired through Vite's CSS plugin.

- An empty `src/shared/` directory or none at all (this procedure creates it).

## Step 1 — Create the token file

Create `src/styles/tokens.css`. Body is exactly the file in [tokens.md](../tokens.md) — paste it verbatim; do not paraphrase token names.

**Completion criterion:** `bun run dev` paints the page; the browser's `:root` computed-style shows every `--au-*` token.

## Step 2 — Create the global stylesheet with the Tailwind bridge

Create `src/styles/global.css`:

```css
@import './tokens.css';
@import 'tailwindcss';

@theme {
  --color-surface: var(--au-color-surface);
  --color-surface-muted: var(--au-color-surface-muted);
  --color-text: var(--au-color-text);
  --color-action: var(--au-color-action);
  --color-action-hover: var(--au-color-action-hover);
  --radius-sm: var(--au-radius-sm);
  --radius-md: var(--au-radius-md);
  --radius-lg: var(--au-radius-lg);
}
```

**Completion criterion:** in the browser, `getComputedStyle(document.body).backgroundColor` matches `--au-color-surface`; the Tailwind utility `class="bg-surface text-action rounded-md"` resolves to the same values as the tokens.

## Step 3 — Create the theme service

Create `src/shared/services/theme.service.ts`. Body is the `IThemeService` + `ThemeService` from [tokens.md](../tokens.md) (the `Theme` union, the `DI.createInterface` token, the singleton implementation). Do not add storage yet — extend in a later step.

## Step 4 — Create the library barrel folder

Create `src/shared/components/ui/index.ts` with the empty barrel (no components yet):

```typescript
export {};
```

It graduates to a real barrel in step 6 when the first component exists.

## Step 5 — Register the theme service globally

In `src/shared/index.ts` (create it if absent), register the theme service:

```typescript
import { Registration } from 'aurelia';
import type { IContainer } from 'aurelia';
import { IThemeService, ThemeService } from './services/theme.service';

export const Shared = {
  register(container: IContainer): void {
    container.register(
      Registration.singleton(IThemeService, ThemeService),
    );
  },
};

export { IThemeService } from './services/theme.service';
export type { Theme } from './services/theme.service';
```

**Completion criterion:** a temporary `const t = resolve(IThemeService); t.setTheme('dark')` toggles `data-theme` on `<html>` and the page repaints dark.

## Step 6 — Create the first component (`ui-button`)

1. Create `src/shared/components/ui/ui-button/`.
2. Inside, place `ui-button.ts` + `ui-button.html` + `ui-button.css` exactly as shown in [component-anatomy.md](../component-anatomy.md).
3. Add it to the barrel:

   ```typescript
   // src/shared/components/ui/index.ts
   export { UiButton } from './ui-button/ui-button';
   export type { ButtonVariant, ButtonSize } from './ui-button/ui-button';
   ```

**Completion criterion:** `<ui-button variant="primary">Save</ui-button>` renders a styled button. Toggling the theme flips the button's surface colour.

## Step 7 — Register the component globally

In `src/shared/index.ts`, add the import and the registration:

```typescript
import { UiButton } from './components/ui';

export const Shared = {
  register(container: IContainer): void {
    container.register(
      UiButton,
      Registration.singleton(IThemeService, ThemeService),
    );
  },
};

export { UiButton } from './components/ui';
export type { ButtonVariant, ButtonSize } from './components/ui';
```

Because the component is globally registered, consumers don't need a `dependencies` array to use it (per the components.md "Global resources" note). The skill re-exports the class + types from `shared/index.ts` for convenience.

## Step 8 — Wire `main.ts`

```typescript
import { Aurelia } from 'aurelia';
import { MyApp } from './my-app';
import { Shared } from './shared';
import './styles/global.css';

void new Aurelia()
  .register(Shared)
  .app(MyApp)
  .start();
```

The `global.css` import is on the line *above* the `Aurelia.start()` resolution, so the first paint is already styled.

**Completion criterion:** the app boots, the first page renders, and `<ui-button>` is usable anywhere — pages, features, even raw HTML.

## Step 9 — Add the remaining library components

Repeat step 6 for each new component (`ui-card`, `ui-input`, `ui-loader`, `ui-modal`, `ui-badge`, `ui-icon`). For each:

1. Create the folder + `name.ts` + `name.html` (+ optional `name.css`).
2. Export from `src/shared/components/ui/index.ts` (class + `export type` for unions).
3. Add to `container.register(...)` in `shared/index.ts`.

Hold the line on the anatomy rules in [component-anatomy.md](../component-anatomy.md). A library element that ships without a class list getter, without `<au-slot>`, or with raw CSS values is not part of the library — it's a feature component in the wrong folder.

## What this procedure does NOT do

- **Migrate existing components into the library** — see [migrate.md](../migrate.md).
- **Lift v1 source first** — if the project has v1 code, run `aurelia-migration` before assembling.
- **Persist theme choice across reloads** — extend `ThemeService.setTheme()` with `localStorage` after the basic library is wired and verified.

## Review checklist

- `src/shared/components/ui/` contains exactly the components in the layout tree from [library-layout.md](../library-layout.md); nothing is duplicated under `features/`.
- Every library element is registered in `shared/index.ts` AND re-exported for downstream `import` use.
- `tailwind.config.{js,ts}` is *not* used — Tailwind v4 reads `@theme` from CSS. If a `tailwind.config.*` file appears, the project is on Tailwind v3 or earlier; pin v4 before proceeding.
- No raw hex, raw `rem`, raw `ms`, or raw `px` outside `tokens.css`.

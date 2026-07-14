# Tokens — the design-token layer

The library has exactly one source of truth for visual values: **CSS custom properties** declared on the root element in `src/styles/tokens.css`. Tailwind utilities consume them through a single `@theme` bridge in `src/styles/global.css`. No other file may re-declare a raw color, spacing, or radius value.

## Why CSS custom properties (not a JS token registry, not Sass vars)

- They are a **DOM/CSS primitive**, not a proprietary abstraction (the Web Standards tenet in `aurelia-foundation/reference/philosophy.md`).
- They cascade through the Light DOM automatically — no extra wiring for child components.
- They re-evaluate at runtime, which is what makes `[data-theme='dark']` overrides and `prefers-color-scheme` work without re-rendering.
- They cross Shadow DOM boundaries, so the same token layer works whether a component is Light or Shadow DOM.
- They ship zero runtime JS; the token layer is one CSS file.

A Sass-variable or JS-token object would force a build step, lock theming to runtime JS, and break Light DOM's cascade. CSS custom properties are the only primitive that satisfies every constraint.

## Naming convention

Use the `--au-<category>-<role>` shape. The `au-` prefix keeps library tokens out of the global namespace; `<category>` groups by purpose; `<role>` is a single, semantic name.

```css
:root {
  --au-color-action: #2563eb;            /* color — interactive emphasis */
  --au-color-action-contrast: #ffffff;   /* readable text on action surfaces */
  --au-space-2: 0.5rem;                  /* space — half-step on a 0.25 rem scale */
  --au-radius-md: 0.375rem;              /* radius — medium corners */
  --au-font-weight-medium: 500;
  --au-duration-fast: 120ms;
  --au-opacity-disabled: 0.5;
}
```

Categories used:

| Category | Purpose | Example suffix |
|---|---|---|
| `color` | Surfaces, text, interaction states | `surface`, `text`, `action`, `danger` |
| `space` | Padding, margin, gap | `1`, `2`, `3`, `4`, `6` |
| `radius` | Border-radius | `sm`, `md`, `lg` |
| `font` | Typography stack, size, weight | `sans`, `size-md`, `weight-medium` |
| `duration` / `ease` | Motion timing | `fast`, `standard` |
| `opacity` | State opacity | `disabled` |
| `shadow` | Elevation | `sm`, `md` |

## The token file — `src/styles/tokens.css`

```css
:root {
  --au-color-surface: #ffffff;
  --au-color-surface-muted: #f5f5f5;
  --au-color-text: #1a1a1a;
  --au-color-text-muted: #6b7280;

  --au-color-action: #2563eb;
  --au-color-action-hover: #1d4ed8;
  --au-color-action-contrast: #ffffff;

  --au-color-danger: #dc2626;
  --au-color-danger-hover: #b91c1c;

  --au-space-1: 0.25rem;
  --au-space-2: 0.5rem;
  --au-space-3: 0.75rem;
  --au-space-4: 1rem;
  --au-space-6: 1.5rem;

  --au-radius-sm: 0.25rem;
  --au-radius-md: 0.375rem;
  --au-radius-lg: 0.5rem;

  --au-font-sans: system-ui, -apple-system, sans-serif;
  --au-font-size-sm: 0.875rem;
  --au-font-size-md: 1rem;
  --au-font-size-lg: 1.125rem;
  --au-font-weight-medium: 500;

  --au-duration-fast: 120ms;
  --au-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);

  --au-opacity-disabled: 0.5;
  --au-shadow-sm: 0 1px 2px rgb(0 0 0 / 0.05);
  --au-shadow-md: 0 4px 8px rgb(0 0 0 / 0.08);

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --au-color-surface: #0f172a;
    --au-color-surface-muted: #1e293b;
    --au-color-text: #e2e8f0;
    --au-color-text-muted: #94a3b8;
    --au-color-action: #3b82f6;
    --au-color-action-hover: #60a5fa;
    --au-color-action-contrast: #0f172a;
    --au-color-danger: #ef4444;
    --au-color-danger-hover: #f87171;
    color-scheme: dark;
  }
}

[data-theme='dark'] {
  --au-color-surface: #0f172a;
  --au-color-surface-muted: #1e293b;
  --au-color-text: #e2e8f0;
  --au-color-text-muted: #94a3b8;
  --au-color-action: #3b82f6;
  --au-color-action-hover: #60a5fa;
  --au-color-action-contrast: #0f172a;
  --au-color-danger: #ef4444;
  --au-color-danger-hover: #f87171;
  color-scheme: dark;
}

[data-theme='light'] {
  color-scheme: light;
}
```

## The Tailwind bridge — `src/styles/global.css`

This file imports `tokens.css` *first*, then Tailwind, then declares `@theme` mappings that *reference* the variables. No raw value is allowed here.

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

Now `bg-surface`, `text-action`, `rounded-md` resolve to the same `--au-*` source the component CSS files consume.

## Runtime theme switching

The browser re-evaluates the entire stylesheet when `data-theme` flips. A singleton service toggles the attribute; nothing else needs to know.

```typescript
import { DI } from 'aurelia';

export type Theme = 'light' | 'dark';

export interface IThemeService {
  readonly current: Theme;
  setTheme(theme: Theme): void;
  toggle(): void;
}

export const IThemeService = DI.createInterface<IThemeService>('IThemeService');

export class ThemeService implements IThemeService {
  public current: Theme = 'light';

  public setTheme(theme: Theme): void {
    this.current = theme;
    document.documentElement.dataset.theme = theme;
  }

  public toggle(): void {
    this.setTheme(this.current === 'light' ? 'dark' : 'light');
  }
}
```

Register the service globally in `shared/index.ts` (see [library-layout.md](library-layout.md)) as `Registration.singleton(IThemeService, ThemeService)`. Consumers inject it via constructor default — `private readonly themes = resolve(IThemeService)` — exactly as `aurelia-runtime/reference/di.md` prescribes.

To persist user choice, extend `setTheme()` to read/write `localStorage` after the attribute flip; the rest of the pipeline needs no changes.

## Review checklist

- `src/styles/tokens.css` owns *every* `--au-*` value; grep for `#[0-9a-f]` outside it — nothing should match.
- `src/styles/global.css` is the only other file with Tailwind's `@theme`; every value there is `var(--au-*)`, never a raw number.
- `[data-theme='dark']` overrides live next to `:root` in the same file — co-location prevents drift.
- `color-scheme` is declared to keep UA form controls in sync with the active theme.

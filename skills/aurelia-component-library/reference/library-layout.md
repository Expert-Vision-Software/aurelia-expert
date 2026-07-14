# Library Layout

Where the component library lives, how its files are organised, and how it registers at startup. The shape is a strict narrowing of the `shared/` admission rule from `aurelia-largespa/reference/directory-layout.md` — that skill owns the rule itself; this skill owns the layout *inside* `shared/components/ui/`.

## The tree

```text
src/
├── styles/
│   ├── tokens.css                         ← see tokens.md
│   └── global.css                         ← tokens + Tailwind + @theme bridge
│
└── shared/
    ├── components/
    │   └── ui/                            ← THE COMPONENT LIBRARY
    │       ├── index.ts                   ← barrel; exports classes + export type for unions
    │       │
    │       ├── ui-button/
    │       │   ├── ui-button.ts
    │       │   ├── ui-button.html
    │       │   └── ui-button.css          ← optional; token-driven rules utilities cannot express
    │       ├── ui-card/
    │       │   ├── ui-card.ts
    │       │   └── ui-card.html
    │       ├── ui-input/                  ← text input + textarea variant
    │       ├── ui-icon/                   ← svg wrapper
    │       ├── ui-loader/                 ← spinner
    │       ├── ui-modal/
    │       └── ui-badge/
    │
    ├── value-converters/
    │   └── variant-converter.ts           ← optional; maps state → token class
    ├── custom-attributes/
    │   └── theme-attr.ts                  ← optional; scoped theme override
    ├── services/
    │   └── theme.service.ts               ← IThemeService singleton (see tokens.md)
    └── index.ts                           ← Shared.register(container) — global registry
```

## One component = one folder or sibling pair

Mirroring `aurelia-foundation/reference/components.md`, every library element has the basename pair:

```text
ui-button/
├── ui-button.ts
├── ui-button.html
└── ui-button.css     ← optional; only when token-driven rules utilities cannot express
```

The `.ts`+`.html` pair is mandatory; the `.css` is opt-in. Tailwind utilities in the HTML can express 90 % of styling; the `.css` file exists for pseudo-selectors (`:hover`, `:disabled`, `:focus-visible`), keyframes, or compound selectors that wrap multiple elements. The `.ts` imports its own `.css`:

```typescript
import { customElement, bindable } from 'aurelia';
import './ui-button.css';
```

Light DOM means the import is global at the page level, which is what we want — library styles apply globally without Shadow DOM gymnastics.

## Naming

| Kind | Required pattern | Example |
| :--- | :--- | :--- |
| Element tag | `ui-` + kebab | `ui-button` |
| Class name | `Ui*` PascalCase | `UiButton` |
| File basename | matches tag | `ui-button.ts` |
| Folder name | matches tag | `ui-button/` |
| Variant/size union | `export type` (type-only) | `export type ButtonVariant = 'primary' \| 'secondary' \| 'ghost'` |
| Service interface token | `I`-prefix | `IThemeService` |

## The barrel — `src/shared/components/ui/index.ts`

Re-exports both runtime classes and type-only unions. Types are `export type`:

```typescript
export { UiButton } from './ui-button/ui-button';
export type { ButtonVariant, ButtonSize } from './ui-button/ui-button';
export { UiCard } from './ui-card/ui-card';
export { UiLoader } from './ui-loader/ui-loader';
```

## The global registry — `src/shared/index.ts`

Every `Ui*` and every cross-cutting service is registered here so consumers don't need a `dependencies` array to use them (globals are ambient, per the components.md "Global resources" note).

```typescript
import { Registration } from 'aurelia';
import type { IContainer } from 'aurelia';
import { UiButton, UiCard, UiLoader } from './components/ui';
import { IThemeService, ThemeService } from './services/theme.service';

export const Shared = {
  register(container: IContainer): void {
    container.register(
      UiButton,
      UiCard,
      UiLoader,
      Registration.singleton(IThemeService, ThemeService),
    );
  },
};

export { UiButton, UiCard, UiLoader } from './components/ui';
export type { ButtonVariant, ButtonSize } from './components/ui';
export { IThemeService } from './services/theme.service';
export type { Theme } from './services/theme.service';
```

## `main.ts` wiring

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

`global.css` MUST be imported before `Aurelia.start()` resolves; otherwise the first paint flashes unstyled.

## When to put something in the library vs a feature folder

Use the `shared/` admission rule from `aurelia-largespa`:

- **Generic UI** with no business vocabulary → `shared/components/ui/` (library).
- **Generic cross-cutting services** (API client, auth, i18n, theming) → `shared/services/`.
- **Anything that mentions a business entity** — `OrderList`, `BillingForm`, `CustomerProfile` → the owning feature under `features/<slice>/components/`.

A button that knows about `Order` is a feature component; the same button that knows about `variant` is a library component.

## Review checklist

- The library root is exactly `src/shared/components/ui/`; no top-level `ui-kit/`, `components/`, `design-system/`, or `widgets/` directories.
- Every `Ui*` element has the `ui-` kebab tag + PascalCase class.
- Every `Ui*` is registered in `shared/index.ts` (or the `index.ts` of a `ui/` sub-folder that `shared/index.ts` re-exports).
- Types that are unions travel through `export type`.
- `.css` files are imported from their sibling `.ts`.
- No library file imports from `features/*`; library code must be feature-agnostic.

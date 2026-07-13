# Canonical Directory Layout

## Contents

- Canonical `src/` tree
- Pages mirror navigation
- Naming
- `shared/` admission rule
- Startup and lazy routes
- Review checklist

The operational rules below anchor the SPA layout. Do not substitute a top-level technical-layer design.

## Canonical `src/` tree

```text
src/
├── features/                 # Business slices (one folder per slice)
│   └── <slice>/
│       ├── components/       # Slice-local custom elements
│       ├── services/         # Slice-local services (DI tokens I-prefixed)
│       ├── models/           # Slice-local behaviour-rich models (NOT DTOs)
│       └── index.ts          # Feature Module: register(container) + child container
├── pages/                    # Thin layout components (orchestrators)
├── shared/                   # Cross-cutting UI, services, value-converters, custom-attributes
│   ├── components/
│   ├── services/             # ApiService, AuthService, I18nService (singleton)
│   ├── value-converters/
│   ├── custom-attributes/
│   └── index.ts              # Shared barrel
└── main.ts                   # Aurelia.register(Shared, ...features).app(MyApp).start()
```

A feature's `models/` contains behavior-rich Models only. Keep each API-contract DTO beside the owning feature service in `services/{entity}-dto.ts`; services convert it before returning. Do not recreate shared top-level `models/`, `entities/`, or `services/` folders.

## Pages mirror navigation

Nest pages when navigation nests, while preserving the `{entity}-page` name:

```text
pages/
├── dashboard-page.ts
├── dashboard-page.html
└── orders/
    ├── orders-page.ts
    ├── orders-page.html
    └── details/
        ├── order-details-page.ts
        └── order-details-page.html
```

Each page is a route target and layout orchestrator. It may hold route/view state, import feature public resources, and pass Models down through bindings. Move validation, API access, transformations, and business decisions into the feature.

## Naming

| Kind | Required pattern | Example |
| :--- | :--- | :--- |
| DTO interface file | `{entity}-dto.ts` | `contact-dto.ts` |
| Model class file | `{entity}.model.ts` | `contact.model.ts` |
| Service file | `{entity}.service.ts` | `contact.service.ts` |
| Service interface/token | `I{Entity}Service` | `IContactService` |
| Page view-model | `{entity}-page.ts` | `contacts-page.ts` |
| Custom element | kebab-case with a hyphen | `contact-list` |

Pair each component or page `.ts` file with an identically based `.html` file. Use `import type` and `export type` whenever a symbol is type-only; DI tokens and classes remain runtime imports.

## `shared/` admission rule

Place a resource in `shared/` only when unrelated features use it and it has no business vocabulary:

- Generic UI: buttons, loaders, modals.
- Cross-cutting services: API client, authentication, internationalization.
- Generic value converters and custom attributes.

Every resource under `shared/` must register globally at startup. Local-only UI belongs in its feature, even if it might be reusable later.

```typescript
// shared/index.ts
import { Registration } from 'aurelia';
import type { IContainer } from 'aurelia';
import { UiButton } from './components/ui-button';
import { UiLoader } from './components/ui-loader';
import { IApiService, ApiService } from './services/api.service';

export const Shared = {
  register(container: IContainer): void {
    container.register(
      UiButton,
      UiLoader,
      Registration.singleton(IApiService, ApiService),
    );
  },
};
```

The barrel must export types as types:

```typescript
export { IApiService, ApiService } from './services/api.service';
export type { ApiRequestOptions } from './services/api-request-options';
```

## Startup and lazy routes

```typescript
// main.ts
import { Aurelia } from 'aurelia';
import { MyApp } from './my-app';
import { Shared } from './shared';
import { OrdersFeature } from './features/orders';

void new Aurelia()
  .register(Shared, OrdersFeature)
  .app(MyApp)
  .start();
```

```typescript
{
  path: 'orders',
  component: () => import('./pages/orders/orders-page'),
  title: 'Orders',
}
```

Use one dynamic route import per slice. With that boundary, Aurelia 2 auto-splits per feature folder through the bundler's page-and-feature dependency graph; do not eagerly import lazy pages from `main.ts` or the app root.

## Review checklist

- The canonical roots are exactly `features/`, `pages/`, and `shared/`.
- Every feature has `components/`, `services/`, `models/`, and `index.ts`.
- Every page is thin and follows `{entity}-page.ts`.
- Every shared resource appears in the `Shared` registry loaded by `main.ts`.
- Custom elements and files are kebab-case; custom events bind with `.trigger`.

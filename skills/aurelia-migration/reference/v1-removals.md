# v1 → v2 Removals & Renames

> **FORBIDDEN.** Never write code in this style — every pattern below throws a
> runtime error, silently breaks in production, or fails compilation in v2.
> When migrating, **lift** in place: replace the v1 call with its v2 replacement
> before touching anything else.

## The lift table

| v1 API | Status | v2 replacement |
| :--- | :--- | :--- |
| `PLATFORM.moduleName('...')` | REMOVED | Native bundler import — no wrapper needed |
| `configureRouter(...)` callback | REMOVED | `@route` decorator co-located on the component |
| `<router-view>` | RENAMED | `<au-viewport>` |
| `<compose view-model="...">` | RENAMED | `<au-compose component="...">` (bindables renamed) |
| `.delegate` on custom events | REMOVED → **AUR0009** | `.trigger` for custom events; `.delegate` only for native DOM |
| `@inject` decorator | REMOVED | `resolve()` functional API |
| `activate(params)` / `deactivate()` hooks | RENAMED | `canLoad` / `loading` / `canUnload` / `unloading` |
| `EventAggregator` as default cross-component bus | DE-EMPHASIZED | Singleton DI service — see `aurelia-authoring` |

Ground truth for every row above lives in the canonical v2 docs referenced in
[reference/deepwiki-protocol.md](deepwiki-protocol.md).

## Per-row examples

### PLATFORM.moduleName — REMOVED

v1 wrapped every component string in a `@aurelia/runtime` helper so the bundler
could resolve it. v2 needs no wrapper; native imports resolve directly.

```typescript
// v1 — FORBIDDEN
import { PLATFORM } from 'aurelia-framework';
export class OrderList { /* PLATFORM.moduleName('order-list') */ }
// template ref:  <require from="...">${PLATFORM.moduleName('order-list')}</require>

// v2 — CORRECT
import { customElement } from 'aurelia';
@customElement('order-list')
export class OrderList {}
// template ref:  <require from="./order-list"></require>     <!-- or just the element name -->
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/components.md)

### configureRouter — REMOVED

v1 configured the router in one central `main.ts` callback. v2 co-locates routes
on the component via `@route`. Routes become transportable — move the file,
the routes follow.

```typescript
// v1 — FORBIDDEN
export class App {
  configureRouter(config, router) {
    config.map([
      { route: 'orders', module: 'orders', nav: true },
      { route: 'customers', module: 'customers', nav: true }
    ]);
  }
}

// v2 — CORRECT
import { route } from '@aurelia/router';
@route({
  path: '',
  routes: [
    { path: 'orders',    component: () => import('./orders'),    title: 'Orders' },
    { path: 'customers', component: () => import('./customers'), title: 'Customers' }
  ]
})
export class App {}
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/routing.md)

### `<router-view>` → `<au-viewport>`

```html
<!-- v1 — FORBIDDEN -->
<router-view></router-view>

<!-- v2 — CORRECT -->
<au-viewport></au-viewport>
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md)

### `<compose view-model>` → `<au-compose component>`

```html
<!-- v1 — FORBIDDEN -->
<compose view-model="modal" model.bind="item"></compose>

<!-- v2 — CORRECT: bindable renamed view-model → component -->
<au-compose component.bind="modal" model.bind="item"></au-compose>
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/runtime-html/docs/au-compose.md)

### `.delegate` → `.trigger` (most-common lift mistake)

**`.delegate` on a custom (non-DOM) event throws AUR0009** at runtime. This is
the single most-encountered migration failure because v1 used `.delegate` for
everything.

```html
<!-- v1 — FORBIDDEN; throws AUR0009 in v2 -->
<nav nav-click.delegate="handleNav($event)"></nav>

<!-- v2 — CORRECT -->
<nav nav-click.trigger="handleNav($event)"></nav>
```

Rule: **`.delegate` handles native DOM events bubbling up** (e.g. `@click.delegate`
on a `<button>`). **`.trigger` raises a custom-event handler** on the element that
fired it. Custom-element authors `dispatchEvent(new CustomEvent('nav-click'))` →
the listener must use `.trigger`. See [reference/debugging.md](debugging.md) for
the full AUR0009 fix.

### `@inject` → `resolve()`

```typescript
// v1 — FORBIDDEN
import { inject } from 'aurelia-framework';
@inject(HttpClient, ILogger)
export class OrderService {
  constructor(http, log) {}
}

// v2 — CORRECT
import { resolve } from 'aurelia';
export class OrderService {
  private http = resolve(HttpClient);
  private log  = resolve(ILogger);
}
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/kernel/docs/di-overview.md)

### `activate` / `deactivate` → `canLoad` / `loading` / `canUnload` / `unloading`

v1 routed through the view-model's `activate(params)` / `deactivate()` hooks.
v2 uses four lifecycle hooks on `IRouteViewComponent`; returning `false` (or a
redirect) from `canLoad` cancels the navigation.

```typescript
// v1 — FORBIDDEN
export class OrderDetails {
  activate(params) { return this.store.load(params.id); }
  deactivate()    { this.store.clear(); }
}

// v2 — CORRECT
export class OrderDetails {
  async canLoad(params, config) {
    if (!this.auth.isSignedIn()) { config.redirect = 'login'; return false; }
    return true;
  }
  async loading(params) { await this.store.load(params.id); }
  async unloading()     { this.store.clear(); }
}
```

[canonical](https://github.com/aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md)

### `@aurelia/compat-v1` shim — for incremental legacy only

The package exists for incremental migration of large v1 surfaces. **Prefer
rewriting over compat-shimming**; the shim adds bundle weight and obscures the
v2 idioms. Use it only when a partial migration is unavoidable.

## Migration lift order (what to lift first)

1. **Shell first.** `PLATFORM.moduleName`, `configureRouter`, `<router-view>`,
   `<compose>` — these touch the most files. Lift these before per-feature work.
2. **Event binding sweep.** `.delegate` → `.trigger` is searchable; do a project
   find/replace scoped to custom events only. Native `.delegate` on `@click`
   stays as `.delegate`.
3. **DI sweep.** `@inject` / constructor-parameter decorators → `resolve()`.
   Leave legacy singletons in place until consumer files are lifted.
4. **Lifecycle hooks.** Rename `activate` / `deactivate` last; these often carry
   business logic that needs manual review, not mechanical rename.

## Secondary v2-only guards (lift migrations only)

These were not part of v1 and are correctness fixes, not removals — but a v1
file with these patterns at the lift step indicates leftover v1 tooling:

- **kebab-case element names.** v1 accepted PascalCase (`UserProfile`); v2 requires
  hyphenated names (`user-profile`). Failing the rename throws at registration.
- **`import type` / `export type` for interfaces.** v1 commonly merged type +
  value exports into a single `export { IFoo }` line. TS verbatim-module syntax
  must split them: `export { IToken }` (runtime) + `export type { IFoo }`
  (type-only). See `aurelia-authoring` for the full split pattern.
- **`.style` property binding** replaces inline `style="...${value}%"`
  interpolation. The prod compiler strips falsy (0, '', false) values from
  inline interpolation, producing empty `style="{};"` — see
  [reference/debugging.md](debugging.md#prod-build-0-value-style-bug).

## Deferred to other skills

- **Authoring conventions after the lift** (Feature-First layout, Model/DTO
  flow, DI token discipline) → `aurelia-authoring`.
- **Vite 8 decorator pipeline** (only relevant when the project is on Vite 8)
  → `aurelia-tooling`.

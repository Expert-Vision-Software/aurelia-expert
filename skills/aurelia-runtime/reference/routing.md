# Routing & navigation reference

Resolve navigation through `@route`, `<au-viewport>`, and `IContextRouter`. There is no central route table.

## Declarative routing with `@route`

Use `@route` co-located with the component.

```typescript
import { route } from '@aurelia/router';

@route({
  path: 'orders',
  routes: [
    { path: '', redirectTo: 'list' },
    { path: 'list', component: () => import('./order-list'), title: 'Orders' },
    { path: ':id', component: () => import('./order-details') },
  ],
})
export class OrdersPage {}
```

**File-system syntax** for paths:

- `/path` — absolute from app root.
- `./path` — local context.
- `../path` — ancestor context.

Use `./` or `../` prefixes — the path resolves relative to the current component, which makes the feature portable across the project.

Lazy-load via dynamic `import()` in `component`. Routes are code-split by default.

## `<au-viewport>` for child routes

Any component declaring child routes has an `<au-viewport>` somewhere in its template:

```html
<!-- orders-page.html -->
<nav>
  <a load="list">List</a>
  <a load="42">View 42</a>
</nav>
<main>
  <au-viewport></au-viewport>
</main>
```

Use `<a load="path">` for declarative links. Avoid `href="/orders/42"` strings.

Containerless `<au-viewport>` elements work, including nested containerless viewports and containerless routed components.

## Context-aware navigation

Resolve relative paths with `IContextRouter`:

```typescript
import { resolve } from 'aurelia';
import { IContextRouter } from '@aurelia/router';

export class OrderDetails {
  private router = resolve(IContextRouter);

  async goBack() {
    await this.router.load('../list');  // sibling of current
  }
}
```

`IContextRouter` makes the feature portable: moving it to another parent doesn't break navigation. Use `IRouter` (the global router) only at the app shell.

## Route parameters with `mergeStrategy`

For deeply nested routes, `IRouteContext.getRouteParameters(strategy)` collects parameters from the full lineage:

```typescript
import { resolve } from 'aurelia';
import { IRouteContext } from '@aurelia/router';

export class NestedComponent {
  private ctx = resolve(IRouteContext);

  // parent-first: ancestor wins on key collision
  get params() { return this.ctx.getRouteParameters('parent-first'); }
  // append: returns arrays preserving full lineage
  get lineage() { return this.ctx.getRouteParameters('append'); }
  // by-route: keyed by route ID
  get byRoute() { return this.ctx.getRouteParameters('by-route'); }
}
```

| Strategy | Returns | When |
|----------|---------|------|
| `parent-first` | Object; ancestor wins on duplicates | Default for most components |
| `append` | Object of arrays, full lineage | Audit, breadcrumb reconstruction |
| `by-route` | Map keyed by route ID | Multi-source params, strict lineage |

## Lifecycle guards

| Hook | Returns | Purpose |
|------|---------|---------|
| `canLoad(params, config)` | `boolean \| { redirect }` | Block navigation; redirect on failure |
| `loading(params, config)` | `Promise \| void` | Async data fetch before render |
| `canUnload()` | `boolean \| string` | Confirm before leaving |
| `unloading()` | `void` | Cleanup before route tear-down |

```typescript
@route({ path: 'admin' })
export class AdminPage {
  async canLoad(params, config) {
    const auth = resolve(IAuthService);
    if (!auth.isAuthenticated()) {
      config.redirect = 'login';
      return false;
    }
    return true;
  }

  loading(params, config) {
    return resolve(IFeatureFlags).loadForRoute(config.route);
  }
}
```

`canLoad` returning `false` blocks the navigation; returning `{ redirect: 'path' }` redirects. `loading` returning a Promise delays the route until it resolves. Returning `false` from `canUnload` cancels the navigation and restores the previous route context. `RouteNode.title` is writable: lifecycle and router hooks can update the title during navigation.

## Router configuration

`RouterConfiguration.customize({ ... })` configures global behavior:

```typescript
Aurelia.register(
  RouterConfiguration.customize({
    useUrlFragmentHash: true,         // hash-based routing
    useEagerLoading: true,            // build the full routing table at startup
    resolutionMode: 'hash-based',     // or 'history-api'
    navigationSyncStates: ['busy', 'swapping', 'completed'],
  }),
);
```

`useEagerLoading` resolves cold-start deep links into nested child routes that on-demand table building can miss.

## V1 contamination

- `configureRouter(config, router)` — gone; use `@route`.
- `Router.navigate(...)` calls — prefer `IContextRouter.load(...)` in feature code.
- `<router-view>` — use `<au-viewport>`.

## Ground truth

- `aurelia/aurelia/blob/master/packages/router-lite/docs/routing-configuration.md`
- `aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md`
- `aurelia/aurelia/blob/master/packages/router-lite/docs/route-context.md`
- `aurelia/aurelia/blob/master/packages/router-lite/docs/router-hooks.md`
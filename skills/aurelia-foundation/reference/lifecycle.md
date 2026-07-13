# Lifecycle

The exact order in which Aurelia moves a component from "not yet instantiated" to "removed from DOM", and what each hook is for. The order matters: cleanup happens in `unbinding`, not `detaching`; child measurements happen after children attach, not before; an asynchronous `binding()` blocks child hydration by design.

## Execution order map

| Phase | Hook | Direction | Run when | Typical use |
|---|---|---|---|---|
| Construct | `constructor()` | — | Instance is created | Field init, default state |
| Activate | `binding(initiator)` | **Top → Down** | Before bindings subscribe | Async data fetch (return a Promise to block) |
| Activate | `bound()` | Top → Down | After bindings subscribe | Post-bind init, listen for own events |
| Insert | `attaching()` | Top → Down | Before DOM insertion | Pre-DOM check, suspense boundary |
| Insert | `attached()` | **Bottom → Up** | After DOM inserted; fully active | DOM measurements, 3rd-party UI init |
| Remove | `detaching()` | **Top → Down** | Before DOM removal | Teardown 3rd-party UI |
| Remove | `unbinding()` | Top → Down | Before bindings unsubscribe | **Hard mandate disposal site** (see below) |

The two directions are the load-bearing rule:

- **Top → Down** (`binding`, `bound`, `attaching`, `detaching`, `unbinding`): the parent runs first, then each child.
- **Bottom → Up** (`attached`): every child runs first, then the parent. This is the only "real" hook for getting accurate DOM measurements — children are guaranteed to be in the tree before the parent's `attached` fires.

## `binding()` can block hydration

Returning a Promise (or making the method `async`) from `binding()` blocks child hydration until the Promise resolves. Use this when a parent's data is required before its children can render correctly.

```typescript
import { customElement } from 'aurelia';

@customElement('order-detail')
export class OrderDetail {
  public order: Order | null = null;

  public async binding(): Promise<void> {
    this.order = await this.fetchOrder();   // blocks child <order-items>
  }
}
```

Trade-off: blocking is correct for *required* data; for optional data, leave `binding` synchronous and load inside the child.

## `attached()` is the only DOM-ready hook

Use `attached()` for anything that reads layout: `getBoundingClientRect()`, `ResizeObserver`, `IntersectionObserver`, 3rd-party chart libraries, browser-native web components initialization.

```typescript
public attached() {
  this.resizeObserver = new ResizeObserver(() => this.relayout());
  this.resizeObserver.observe(this.host);
}
```

The teardown for any resource initialized in `attached` belongs in `detaching` (3rd-party UI) or `unbinding` (DOM-agnostic listeners).

## `unbinding` is the hard-mandate disposal site

The single most common bug class in Aurelia components is **leaked subscriptions**: an `IEventAggregator` subscription, a `MutationObserver`, a `setInterval`, a `socket.io` connection — anything that outlives the component. The lifecycle expects you to dispose those here.

```typescript
import { customElement } from 'aurelia';
import { resolve } from 'aurelia';
import type { IEventAggregator, IDisposable } from 'aurelia';
import type { IUserService } from './services/user-service';

@customElement('user-profile')
export class UserProfile {
  private ea = resolve(IEventAggregator);
  private userService = resolve(IUserService);
  private subs: IDisposable[] = [];

  public binding() {
    this.subs.push(this.ea.subscribe('user:updated', () => this.refresh()));
  }

  public unbinding() {
    for (const sub of this.subs) sub.dispose();
    this.subs = [];
  }
}
```

Why this rule is non-negotiable:

- The framework guarantees `unbinding` fires exactly once before the component's bindings release.
- `detaching` may run before all subscriptions are gone (DOM teardown races).
- `attached` fires only on *initial* mount; routes that re-mount the same view-model still call `unbinding` between mounts.
- Long-lived services (singletons) hold references to event subscribers; without disposal, **the entire component object and its closure are pinned in memory forever**.

For singleton DI services, **`unbinding` is the primary counter**, not `Event Aggregator` itself — services return Models, not DTOs, and components subscribe through typed service methods, not `ea.subscribe('string', callback)`.

## Router lifecycle hooks (replaces v1 `activate`/`deactivate`)

Aurelia 2 routing replaces the v1 `activate` / `deactivate` hook pair with a four-stage loader lifecycle. All four are class members on the routed component.

```typescript
import { route } from '@aurelia/router';
import { resolve } from 'aurelia';
import type { IAuthService } from './services/auth-service';

@route('protected')
export class ProtectedPage {
  private auth = resolve(IAuthService);

  async canLoad(params, config) {
    if (!this.auth.isAuthenticated()) {
      config.redirect = 'login';
      return false;
    }
    return true;
  }

  async loading(params) {
    await this.fetchData(params);
  }

  async canUnload(config) {
    return window.confirm('Discard unsaved changes?');
  }

  async unloading() {
    this.cleanup();
  }
}
```

| v1 (forbidden) | v2 (use this) | When |
|---|---|---|
| `activate(params, config)` | `canLoad(params, config)` / `loading(params)` | Gate entry, async load |
| `canDeactivate()` | `canUnload(config)` | Gate exit, prompt to save |
| `deactivate()` | `unloading()` | Async cleanup on exit |

## App Tasks (cross-cutting concerns)

App-level lifecycle hooks run during framework phases. They're useful for global config, telemetry, and feature-flag wiring. They live in `main.ts`, not in components.

```typescript
import { Aurelia, AppTask, Registration } from 'aurelia';
import type { IApiConfig } from './config/api-config';
import { prodConfig } from './config/prod';
import { devConfig } from './config/dev';

Aurelia.register(
  AppTask.creating(IContainer, container => {
    const cfg = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;
    Registration.instance(IApiConfig, cfg).register(container);
  })
).app(MyApp).start();
```

| Phase | When | Typical use |
|---|---|---|
| `creating` | Last chance before root view-model instantiates | Env config, feature flags |
| `hydrating` | After root view instantiation, before child compile | Async data for root |
| `hydrated` | After root self-hydration | Telemetry bootstrap |
| `activating` | Scope hierarchy formed | Role-based feature loading |
| `activated` | App is fully running | Late init |
| `deactivating` | Save state before stopping | Persist to localStorage |
| `deactivated` | Final cleanup | Release external handles |

## v1 contamination check

- `activate` / `deactivate` → `canLoad` / `loading` / `canUnload` / `unloading`.
- Central `configureRouter(config, router)` block → component-owned `@route` decorator with `<au-viewport>`.
- `<router-view>` → `<au-viewport>`.

When you're ready to scaffold the AI prompt that holds the foundation, see [ai-tooling.md](ai-tooling.md).

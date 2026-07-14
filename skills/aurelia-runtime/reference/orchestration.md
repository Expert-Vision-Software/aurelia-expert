# Cross-feature orchestration reference

Resolve cross-feature wiring with four primitives: bindables down, custom events up, service-as-store, thin page.

## The four primitives

| Primitive | Direction | Mechanism |
|-----------|-----------|-----------|
| **Bindables down** | Parent → child | `<child prop.bind="parentValue">` |
| **Custom event up** | Child → parent | `<child on-change.trigger="handler($event.detail)">` |
| **Service-as-store** | Any → any | `resolve(ISharedState)` returns shared state |
| **Thin page** | Mediator | Page wires services + components; no logic |

Together: a feature has no business logic in the page. Children expose bindables, fire custom events, and resolve shared state. The page is a wiring diagram.

## Bindables down

The parent passes state to a child via `@bindable`:

```typescript
import { customElement, bindable } from 'aurelia';

@customElement('order-row')
export class OrderRow {
  @bindable public order: OrderModel;
}
```

```html
<!-- parent template -->
<order-row order.bind="currentOrder"></order-row>
```

Two-way: `@bindable({ mode: 'twoWay' })`. Read-only: `@bindable public value` defaults to one-way (model → view).

## Custom event up

The child fires a custom event; the parent handles via `.trigger`:

```typescript
import { customElement, bindable } from 'aurelia';

@customElement('user-picker')
export class UserPicker {
  @bindable public user: UserModel;

  private select(u: UserModel) {
    this.user = u;
    // Fire custom event up — .trigger, not .delegate.
    this.dispatchEvent(new CustomEvent('user-changed', { detail: u }));
  }
}
```

```html
<!-- parent template -->
<user-picker
  user.bind="selectedUser"
  user-changed.trigger="handleUserUpdate($event.detail)">
</user-picker>
```

`.trigger` (not `.delegate`) — otherwise throws **AUR0713** at compile time. Full rationale: [reference/events-tasks.md](events-tasks.md).

## Service-as-store

A singleton DI service holds shared state. Components `resolve` the service directly, bypassing prop drilling:

```typescript
import { DI, resolve } from 'aurelia';

export interface ICartStore {
  items(): readonly CartItem[];
  add(item: CartItem): void;
  total(): number;
}

export const ICartStore = DI.createInterface<ICartStore>(
  'ICartStore',
  x => x.singleton(CartStore),
);
export type ICartStore = ICartStore;

class CartStore {
  private list: CartItem[] = [];
  items() { return this.list; }
  add(item: CartItem) { this.list.push(item); }
  total() { return this.list.reduce((s, i) => s + i.price, 0); }
}
```

```typescript
// Any component, any depth — no prop drilling.
export class CartBadge {
  private cart = resolve(ICartStore);
  get count() { return this.cart.items().length; }
}

export class AddToCartButton {
  private cart = resolve(ICartStore);
  add(item: CartItem) { this.cart.add(item); }
}
```

| Use when | Don't use when |
|----------|----------------|
| Entity-specific state (cart, current user, draft order) | Pure cross-component UI state (modal open) |
| Cached data with TTL | Per-request transient data |
| User preferences | Process-global state with reducers |

The service exposes **Models**, not DTOs. Conversion happens at the API boundary (`Model.fromDTO` / `model.toDTO`). Full DI lifecycle and resolver details: [reference/di.md](di.md).

## Thin page component

A page is a mediator, not a logic host:

```typescript
import { resolve, customElement } from 'aurelia';
import { route } from '@aurelia/router';
import type { IOrderService } from './services/order.service';

@route({ path: 'orders' })
@customElement('orders-page')
export class OrdersPage {
  // 1. Resolve services.
  private orders = resolve(IOrderService);

  // 2. Delegate to children via bindables.
  // 3. Receive child events via .trigger handlers.
  // No business logic here.
}
```

```html
<!-- orders-page.html -->
<order-filter
  criteria.bind="filters"
  changed.trigger="applyFilters($event.detail)">
</order-filter>
<order-list orders.bind="orders.all()"></order-list>
```

The page:
1. Resolves services.
2. Passes data down via bindables.
3. Receives events up via `.trigger`.
4. Owns zero state mutations.

If logic grows beyond wiring, it moves into a service or a child component — not the page.

## State management hierarchy

Resolve state from the most local level that works:

1. **Component-local**: instance fields on the component.
2. **Service-as-store** (singleton DI): for shared state within a feature subtree.
3. **Root container registration**: for truly app-wide singletons (auth, feature flags).
4. **Avoid** `IEventAggregator` — see [reference/events-tasks.md](events-tasks.md) for why.

## Ground truth

- `aurelia/aurelia/blob/master/packages/runtime-html/docs/bindable-properties.md`
- `aurelia/aurelia/blob/master/packages/runtime-html/docs/element-observation.md`
- `aurelia/aurelia/blob/master/packages/runtime-html/docs/component-instantiation.md`
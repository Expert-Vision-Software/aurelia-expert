# Thin-Page Orchestrator and Service-as-Store

## Contents

- Orchestrator rule
- Bindables down, events up
- Service-as-store
- State ownership
- Validation

## Orchestrator rule

A page is the route-level composition boundary. It holds shared **view state**, loads Models through feature services, passes data down with declarative bindings, and receives bubbled custom events. It contains no API mapping, validation policy, calculations, or business decisions.

```typescript
// pages/orders/orders-page.ts
import { resolve, customElement } from 'aurelia';
import { IOrderService, OrderDetails, OrderList } from '../../features/orders';
import type { OrderModel } from '../../features/orders';

@customElement({
  name: 'orders-page',
  dependencies: [OrderList, OrderDetails],
})
export class OrdersPage {
  public orders: readonly OrderModel[] = [];
  public selectedOrder?: OrderModel;

  public constructor(
    private readonly orderService: IOrderService = resolve(IOrderService),
  ) {}

  public async binding(): Promise<void> {
    this.orders = await this.orderService.getOrders();
  }

  public selectOrder(event: CustomEvent<OrderModel>): void {
    this.selectedOrder = event.detail;
  }
}
```

```html
<!-- pages/orders/orders-page.html -->
<order-list
  orders.bind="orders"
  order-selected.trigger="selectOrder($event)">
</order-list>

<order-details order.bind="selectedOrder"></order-details>
```

The child dispatches a typed, bubbling `CustomEvent<OrderModel>` named `order-selected`. The page listens with `.trigger`; never use `.delegate` for a custom event.

## Bindables down, events up

- Parent page to feature: Models, immutable collections, IDs, and view options through bindables.
- Feature to parent page: intent through kebab-case custom events with typed `detail` and `bubbles: true`.
- Shared business state: an injected service contract, not an Event Aggregator channel.

A child must not mutate a parent-owned object merely to signal intent. Emit an event or call a typed service method.

## Service-as-store

Use a singleton DI service when multiple components in a capability need the same reactive state. Public reactive properties hold state; typed methods own transitions and API work. Inject a contract such as `IUserService`, never its `UserService` implementation class.

```typescript
import { DI } from 'aurelia';
import type { UserModel } from '../models/user.model';

export interface IUserStore {
  readonly currentUser?: UserModel;
  loadCurrentUser(): Promise<UserModel>;
  clear(): void;
}

export class UserStore implements IUserStore {
  public currentUser?: UserModel;

  public async loadCurrentUser(): Promise<UserModel> {
    const user = await this.fetchCurrentUserModel();
    this.currentUser = user;
    return user;
  }

  public clear(): void {
    this.currentUser = undefined;
  }

  private async fetchCurrentUserModel(): Promise<UserModel> {
    throw new Error('Implement through the API/DTO boundary');
  }
}

export const IUserStore = DI.createInterface<IUserStore>(
  'IUserStore',
  x => x.singleton(UserStore),
);
```

Consumers import `IUserStore` as a runtime DI token and resolve it; they never resolve `UserStore` directly. Use `DI.createInterface<IUserStore>('IUserStore', x => x.singleton(UserStore))` for an app-wide store. For a feature-scoped store, create the token without a default and register it with `Registration.singleton` in the feature child container.

## State ownership

| State | Owner |
| :--- | :--- |
| Route params, current tab, selected row | Thin page |
| Capability entities, cache, loading/error state | Feature service-as-store |
| Auth/session, API configuration, locale | Globally registered shared singleton |
| Input draft private to one component | That component |

Prefer service-as-store over `IEventAggregator`: dependencies remain typed, visible, mockable, and scoped. If existing `ea` subscriptions remain, dispose every subscription in `unbinding`.

## Validation

- Pages orchestrate and hold view state only.
- Feature components receive Models through bindables and emit typed bubbling events.
- Custom event listeners use `.trigger`.
- Shared state is behind an `I`-prefixed singleton service token.
- No component receives a DTO or resolves a concrete service class.

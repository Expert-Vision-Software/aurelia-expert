# Feature Module Pattern

## Contents

- Service contract
- `index.ts` registration
- Resolution
- Local resources
- Encapsulation rules
- Validation

A feature's `index.ts` is its registration boundary and intentional public entry. Keep internals inside `components/`, `services/`, and `models/`.

## Service contract

Define an `I`-prefixed contract and DI token. The token is a runtime value; DTOs and other type-only symbols use type imports.

```typescript
// services/order.service.ts
import { DI } from 'aurelia';
import type { OrderModel } from '../models/order.model';

export interface IOrderService {
  getOrders(): Promise<readonly OrderModel[]>;
}

export const IOrderService = DI.createInterface<IOrderService>('IOrderService');

export class OrderService implements IOrderService {
  public async getOrders(): Promise<readonly OrderModel[]> {
    // Map API DTOs to OrderModel instances at this boundary.
    return [];
  }
}
```

## `index.ts` registration

Create a child container and register feature-scoped services as singletons in that child:

```typescript
// features/orders/index.ts
import { Registration } from 'aurelia';
import type { IContainer } from 'aurelia';
import { IOrderService, OrderService } from './services/order.service';

export { OrderList } from './components/order-list';
export { OrderDetails } from './components/order-details';
export { IOrderService } from './services/order.service';
export type { OrderDTO } from './services/order-dto';
export { OrderModel } from './models/order.model';

export const OrdersFeature = {
  register(container: IContainer): IContainer {
    const child = container.createChild();
    child.register(
      Registration.singleton(IOrderService, OrderService),
    );
    return child;
  },
};
```

Use the returned child as the feature scope. Register shared services in the root `Shared` registry instead. Do not register the same token both through `DI.createInterface(..., x => x.singleton(...))` and `Registration.singleton(...)`; choose the registration boundary that owns its lifetime.

Default feature data services and service-as-store instances to singleton per feature container. Use transient only when the nearest directory-level `Agents.md` explicitly identifies stateless or disposable instances.

## Resolution

Components depend on the interface token, never the implementation class:

```typescript
import { resolve } from 'aurelia';
import { IOrderService } from '../services/order.service';

export class OrderList {
  public constructor(
    private readonly orders: IOrderService = resolve(IOrderService),
  ) {}
}
```

Constructor defaults preserve direct mock injection in tests while enforcing `resolve()` in production.

## Local resources

Declare slice-local custom elements, value converters, and custom attributes in the consuming component's dependencies array:

```typescript
import { customElement } from 'aurelia';
import { OrderRow } from './order-row';
import { MoneyValueConverter } from './money-value-converter';

@customElement({
  name: 'order-list',
  dependencies: [OrderRow, MoneyValueConverter],
})
export class OrderList {}
```

Keep `order-list.ts` paired with `order-list.html`. Local dependencies prevent global-name pollution, preserve feature portability, and keep unused features tree-shakable.

## Encapsulation rules

- Export only what pages or route composition need; do not barrel-export every internal file.
- Do not import pages or another feature's internals.
- Keep custom element names kebab-case.
- Keep feature DTO contracts beside their owning service in `services/`; keep behavior-rich Models in `models/`. Services expose Models only.
- Keep cross-cutting API/auth/i18n services in globally registered `shared/`.

## Validation

- `index.ts` has `register(container)`, calls `container.createChild()`, and returns the child.
- Every feature-scoped service has an `I`-prefixed token and explicit lifecycle.
- Components resolve tokens rather than concrete classes.
- Every local custom resource appears in `dependencies`.
- Type-only imports and exports use `import type` or `export type`.

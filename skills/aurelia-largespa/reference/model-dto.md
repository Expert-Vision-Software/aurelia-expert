# Model/DTO Boundary

## Contents

- Contract and file ownership
- DTO interfaces
- Behavior-rich nested Models
- Service boundary
- Request deduplication
- Validation

## Contract

DTOs mirror the external API contract and use its PascalCase field names. Models use camelCase, own behavior, and may contain nested Models. Services perform every conversion and expose only Models to pages and components.

```text
API response -> DTO -> Model.fromDTO() -> service/page/component
API request  <- DTO <- model.toDTO()    <- service
```

Use `services/{entity}-dto.ts` for a DTO interface beside its owning API-facing service and `models/{entity}.model.ts` for a Model class. Both remain inside the owning feature; `models/` contains Models, not DTOs.

## DTO interfaces

```typescript
// services/address-dto.ts
export interface AddressDTO {
  Line1: string;
  City: string;
}

// services/order-dto.ts
import type { AddressDTO } from './address-dto';

export interface OrderDTO {
  Id: number;
  CustomerName: string;
  Status: 'Open' | 'Closed';
  ShippingAddress?: AddressDTO;
}
```

DTOs contain contract shape, not behavior or view state. Import and export them with `import type`/`export type` whenever no runtime value is needed.

## Behavior-rich nested Models

```typescript
// models/address.model.ts
import type { AddressDTO } from '../services/address-dto';

export class AddressModel {
  public constructor(
    public readonly line1: string,
    public readonly city: string,
  ) {}

  public static fromDTO(dto: AddressDTO): AddressModel {
    return new AddressModel(dto.Line1, dto.City);
  }

  public toDTO(): AddressDTO {
    return { Line1: this.line1, City: this.city };
  }
}
```

```typescript
// models/order.model.ts
import type { OrderDTO } from '../services/order-dto';
import { AddressModel } from './address.model';

export class OrderModel {
  public constructor(
    public readonly id: string,
    public customerName: string,
    public status: 'open' | 'closed',
    public shippingAddress?: AddressModel,
  ) {}

  public static fromDTO(dto: OrderDTO): OrderModel {
    return new OrderModel(
      dto.Id.toString(),
      dto.CustomerName,
      dto.Status === 'Open' ? 'open' : 'closed',
      dto.ShippingAddress
        ? AddressModel.fromDTO(dto.ShippingAddress)
        : undefined,
    );
  }

  public close(): void {
    this.status = 'closed';
  }

  public toDTO(): OrderDTO {
    return {
      Id: Number.parseInt(this.id, 10),
      CustomerName: this.customerName,
      Status: this.status === 'open' ? 'Open' : 'Closed',
      ShippingAddress: this.shippingAddress?.toDTO(),
    };
  }
}
```

Nested conversion is recursive. Do not retain a DTO inside a Model as hidden mutable state.

## Service boundary

```typescript
public async getOrders(): Promise<readonly OrderModel[]> {
  const dtos = await this.api.get<OrderDTO[]>('/orders');
  return dtos.map(dto => OrderModel.fromDTO(dto));
}

public async saveOrder(order: OrderModel): Promise<OrderModel> {
  const saved = await this.api.put<OrderDTO>('/orders', order.toDTO());
  return OrderModel.fromDTO(saved);
}
```

The API client may be shared infrastructure; the conversion remains in the owning feature service. A page never calls `fromDTO()` to compensate for a leaking service.

## Request deduplication

A singleton service-as-store deduplicates concurrent reads by caching the in-flight `Promise`, not only the completed value:

```typescript
private readonly pending = new Map<
  string,
  Promise<readonly OrderModel[]>
>();

public async getOrders(
  customerId: string,
  forceRefresh = false,
): Promise<readonly OrderModel[]> {
  const key = `orders:${customerId}`;
  const existing = this.pending.get(key);
  if (!forceRefresh && existing) return existing;

  const request = this.loadOrderModels(customerId);
  this.pending.set(key, request);

  try {
    return await request;
  } finally {
    if (this.pending.get(key) === request) this.pending.delete(key);
  }
}
```

Key by every argument that changes the response. The identity check prevents an older request from deleting a newer forced refresh.

## Validation

- API contract fields are PascalCase DTO fields.
- Models use camelCase and contain domain behavior.
- Every inbound path calls `fromDTO()` and every outbound path calls `toDTO()`.
- Nested DTOs become nested Models.
- Service signatures exposed to UI contain no DTO types.
- Concurrent equivalent requests share one in-flight Promise.

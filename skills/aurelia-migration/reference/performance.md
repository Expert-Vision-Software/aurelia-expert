# Performance

The three levers that move the needle on Aurelia 2 performance: **.to-view**
for read-only DOM (skips observation), **`batch()`** to group updates, and
**lazy resolver** to defer expensive construction. Everything else is
secondary.

## Bind modes and what they cost

| Mode | Cost | Use for |
| :--- | :--- | :--- |
| `.bind` (default) | Property observation subscribed both directions | Forms, interactive UI |
| `.to-view` | One-way write only — no observation subscription | Read-only data, dashboards, list rows |
| `.from-view` | One-way observe view → model | Rare; user-driven one-way flux |
| `.one-time` | Set once at bind, never touched again | Truly static labels, headers |

**`.bind` is the default; `.to-view` is mandatory for performance-critical
read-only data** to skip the per-property observation subscription.

```html
<!-- WRONG: .bind on 500 list rows = 500 observation subscriptions -->
<tr repeat.for="row of rows">
  <td>${row.name}</td>
  <td>${row.total}</td>
</tr>

<!-- RIGHT: one-way for read-only rows -->
<tr repeat.for="row of rows">
  <td>${row.name}</td>
  <td>${row.total & signal: 'totals'}</td>
  <!-- or simpler: -->
</tr>
```

In practice the leverage is the `repeat.for` + `.to-view` matrix — set read-
only fields to `.to-view` and `repeat.for` will skip the per-row observation
overhead on each cycle.

## batch() — group DOM writes

Multiple DOM updates inside a `batch()` callback commit a single render. Use it
when a selection operation, row toggle, or filter touches many bindable
properties at once.

```typescript
import { batch } from 'aurelia';

selectAll() {
  batch(() => {
    this.contacts.forEach(c => this.selectedIds.add(c.id));
    this.lastSelectedIndex = this.contacts.length - 1;
    this.toolbarState = 'bulk-edit';
  });
}
```

Without `batch`, each property assignment schedules its own render. With it,
one render commits the whole intent. **Use on user-initiated multi-select,
filter-and-paginate, and bulk-edit operations.**

## Lazy resolver for expensive services

```typescript
import { resolve, lazy } from 'aurelia';

export class Dashboard {
  // Recharts/Konva/PDF-lib are not touched until first request
  private getChart = resolve(lazy(IChartService));
  private getPdf = resolve(lazy(IPdfService));

  async export() {
    const chart = await this.getChart().render(this.series);
    const pdf   = await this.getPdf().build(chart);
  }
}
```

`resolve(lazy(Token))` returns a thunk; the service only instantiates when the
thunk is called. Use it for: charting libraries, PDF exporters, code-mirror,
heavy parsers, anything ≥100ms to construct.

## Singleton service for shared state (vs. EventAggregator)

If two components need the same data — repeat the fetch and they desync.
Register once, share, mutate in place. The "Service as Store" pattern from
`aurelia-authoring` collapses this.

```typescript
export const IOrderCache = DI.createInterface<IOrderCache>('IOrderCache',
  x => x.singleton(OrderCache));

export class OrderCache {
  private orders: OrderModel[] = [];
  private pending = new Map<string, Promise<OrderModel[]>>();

  async list(force = false): Promise<OrderModel[]> {
    if (force) return this.load();
    const cached = this.pending.get('all');
    if (cached) return cached;
    const p = this.load();
    this.pending.set('all', p);
    try { return await p; }
    finally { this.pending.delete('all'); }
  }
}
```

Pending-request deduplication prevents N components from firing N parallel
`fetch('/orders')` calls in the same tick. This is the Enterprise Standard for
shared data; it avoids EventAggregator's untyped-payload anti-pattern.

## Cached registration for one-shot computations

```typescript
export const IBaseHref = DI.createInterface<IBaseHref>('IBaseHref',
  x => x.cachedCallback(() => {
    const base = document.querySelector('base')?.href
              ?? `${location.origin}/`;
    return new URL(base).toString();
  }));
```

`cachedCallback` runs the factory once, caches the result per container. Use for:
parsing `location`, computing base HREFs, reading bootstrap config.

## Computed-property discipline

A getter that does heavy work on every read is a hidden perf cliff. Memoise the
result; invalidate on explicit change.

```typescript
export class OrderRow {
  @bindable order: OrderModel;

  // Computed once per `order` reference
  private _taxMemo: { forOrder: OrderModel; value: number } | null = null;
  get tax(): number {
    if (this._taxMemo?.forOrder !== this.order) {
      this._taxMemo = {
        forOrder: this.order,
        value: round2(this.order.subtotal * 0.0825)
      };
    }
    return this._taxMemo.value;
  }
}
```

Aurelia does **not** auto-memoise getters. If a getter is non-trivial and the
host template re-evaluates per render cycle, memoise it.

## Pure-pipe discipline (value converters)

Value converters run on every change-detection pass unless they're marked
and used as one-way. For formatting that should not re-run, hoist into a
precomputed property instead of returning the converter at the call site.

```html
<!-- WRONG: 'currency' converter runs every render -->
<td>${row.total | currency}</td>

<!-- RIGHT: format once when the row arrives -->
<td>${row.totalFormatted}</td>
```

```typescript
// Service layer
orders.map(o => ({ ...o, totalFormatted: fmtCurrency(o.total) }));
```

This is the same trade-off as `.bind` vs `.to-view`; the converter is `.bind`
by default, the precomputed string is `.one-time`.

## What this skill defers

- **Lazy-loading entire modules/routes** — see `AppTask.hydrating` pattern in
  [reference/debugging.md](debugging.md#lazy-registering-plugins-issue-145--aureliaframework).
- **Virtual scrolling / windowed lists** — depends on the table grid library.
- **Service-worker and offline caching** — outside this skill's surface.

# Debugging & Troubleshooting

Aurelia 2 throws **AUR0xxx** codes for framework errors and **.bind** for
binding/logic errors. The codes are designed to be searchable; below covers
the high-frequency ones plus the production-only traps that hide in dev.

## Common AUR0xxx codes

| Code | Trigger | Fix |
| :--- | :--- | :--- |
| **AUR0713** | Unknown binding command — removed `.delegate` (any event), removed `.call`, or a typo (`value.bin`) | `.trigger` for all event listeners; lambdas instead of `.call`; fix typos. Valid commands: `.bind` `.one-time` `.to-view` `.from-view` `.two-way` `.trigger` `.capture` `.attr` `.style` `.class` `.ref` `.for` `.spread` |
| **AUR0010** | An intrinsic type (`String`, `Number`, …) used as a DI token | Use a real token — a class or `DI.createInterface` — and inject it with `@inject(Key)` |
| **AUR0012** | `resolve()`/`get()` of an interface with no registration and no default implementation | Register an implementation, or declare a default: `DI.createInterface('Foo', x => x.singleton(FooImpl))` |
| **AUR0017** | Same as AUR0012 but via `newInstanceOf` / `newInstanceForScope` | Register the interface or give it a default implementation |
| **AUR0019** | Invalid event name or instance passed to Event Aggregator `publish` | Pass a string channel name or a valid event instance |
| **AUR0022** | `@inject` decorator applied to an unsupported target type | Apply `@inject` only to classes — prefer `resolve()` |
| **AUR0717** | `<slot>` without Shadow DOM enabled | Either set `shadowOptions: { mode: 'open' }` on the custom element OR replace `<slot>` with `<au-slot>` |
| **AUR0501** | `containerless: true` combined with Shadow DOM `shadowOptions` | Pick one — `containerless` removes the host element a ShadowRoot attaches to |
| **AUR0907** | Dialog cancelled while `rejectOnCancel` is set | Handle the rejection from `.whenClosed()` / the `await` |
| **AUR0177** | Unsupported `repeat.for` destructuring — nested patterns, duplicate locals, reserved names (`$index`, `$item`) | Use shallow object destructuring with aliases (`repeat.for="{ id: orderId } of items"`); for deeper access, repeat the whole object and read its properties |

## AUR0713 — unknown binding command (`.delegate`, most common)

```html
<!-- throws AUR0713 (template compilation error) -->
<nav nav-click.delegate="handleNav($event)"></nav>
```

`.delegate` is removed from the v2 binding command set — for custom and native
DOM events alike. `.trigger` is the only event-listener command; it attaches the
handler to the element itself.

```html
<!-- correct: handler fires when the <nav> raises 'nav-click' -->
<nav nav-click.trigger="handleNav($event)"></nav>
```

Native DOM events use `.trigger` (or the shorthand `@click`):

```html
<nav>
  <button @click.trigger="open()">Open</button>                <!-- native DOM -->
  <child-nav nav-click.trigger="handleNav($event)"></child-nav>  <!-- custom event -->
</nav>
```

`.call` throws the same AUR0713 — lift it to a lambda expression. An incremental
migration can register `@aurelia/compat-v1`'s `compatRegistration` to re-add
`.delegate` temporarily.

See [reference/v1-removals.md](v1-removals.md#delegate--trigger-most-common-lift-mistake).

## AUR0717 — `<slot>` without Shadow DOM

Aurelia 2 distinguishes native slots (only meaningful inside Shadow DOM) from
its own `au-slot` projection system. Using a plain `<slot>` in a Light DOM
custom element throws **AUR0717**.

```typescript
// Custom element with shadow DOM
@customElement({
  name: 'shadow-card',
  template: '<div class="card"><slot></slot></div>',
  shadowOptions: { mode: 'open' }
})
export class ShadowCard {}
```

```typescript
// Custom element using light-DOM projection (no shadow)
@customElement({
  name: 'light-card',
  template: '<div class="card"><au-slot></au-slot></div>'
})
export class LightCard {}

// Consumer
<light-card>
  <span au-slot>projected content</span>
</light-card>
```

## Prod-build 0-value style bug

`style="width: ${partyShare('D')}%"` compiles correctly in dev, but the prod
compiler optimizer strips the placeholder when the runtime value is `0` (or any
falsy value), producing `style="width:{};"`. The bar renders at intrinsic
content width. Only visible after deploy.

```html
<!-- WRONG — dev shows it, prod silently strips -->
<div style="width: ${partyShare('D')}%"></div>

<!-- RIGHT — runtime expression always emits a value -->
<div width.style="partyShare('D') + '%'"></div>

<!-- For multi-property CSS objects -->
<div style.bind="{ width: progress + '%', backgroundColor: theme }"></div>
```

The `.style` property binding is a JS expression evaluated at runtime. The
inline `style="..."` attribute interpolation is pre-parsed at compile time and
the optimizer drops placeholders for falsy runtime values.

## Type-only import failures

Splitting an interface from its DI token exposes a v1-style merged export that
breaks under `verbatimModuleSyntax`.

```typescript
// BROKEN — interface and token on one line; "does not provide an export named X"
export { IFooService, FooInput } from "./foo";

// CORRECT — split runtime from type-only
export { IFooService } from "./foo";
export type { FooInput } from "./foo";
```

```typescript
// Consumer
import { IFooService } from "./foo";
import type { FooInput } from "./foo";
```

Enforced by `{ "isolatedModules": true, "verbatimModuleSyntax": true }` in
`tsconfig.json`. See `aurelia-authoring` for the full barrel-file pattern.

## EventAggregator as a hidden global state bus

If a cross-component event pattern "just works" but produces untyped payloads
and hard-to-find memory leaks, the root cause is `EventAggregator` (or v2
`IEventAggregator`) being used as a default state bus. The fix is a singleton
DI service with explicit typed methods.

```typescript
// DI service — explicit, type-safe, testable
export const IOrderBus = DI.createInterface<IOrderBus>('IOrderBus',
  x => x.singleton(OrderBus));

export interface IOrderBus {
  onSelected(handler: (id: string) => void): () => void;  // returns unsubscribe
  emitSelected(id: string): void;
}

// Cleanup in unbinding — never skip
unbinding() {
  this.unsubscribers.forEach(u => u());
  this.unsubscribers.length = 0;
}
```

Every subscription returns an unsubscribe handle; the `unbinding` hook calls
them. Skipping this is the primary memory-leak cause.

## Quick Reference ("How Do I…")

| When you want to… | Reach for |
| :--- | :--- |
| Apply dynamic CSS values | `.style` property binding, not inline interpolation |
| Find why `.delegate` throws | [AUR0713 above](#aur0713--unknown-binding-command-delegate-most-common) |
| Use `<slot>` in a custom element | Enable Shadow DOM **or** switch to `<au-slot>` |
| Split merged v1 interface + token exports | `import type` / `export type` + tsconfig flags |
| Replace EventAggregator with typed DI | Singleton service with `onX(handler) → unsubscribe` |
| Trace a binding to its source | Add `.bind`-mode inspection via `DebugProfiler`; check `.bind` vs `.to-view` choice |
| Register a plugin lazily (Issue #145) | Move registration into `AppTask.hydrating(IAppTask, ...)` with dynamic `await import()` |
| Improve a slow list | `.to-view` per row, use `repeat.for` over `@for` analogue, `batch()` for selection updates |
| Migrate `activate(params)` | `loading(params)` for fetch; `canLoad(params, config)` for guard |
| Check route param lineage | `routeContext.getRouteParameters('append')` — see `aurelia-authoring` |

### Lazy-registering plugins (Issue #145 · aurelia/framework)

Plugins registered at module scope bundle into the main entry — defeating code
splitting. Register inside an `AppTask.hydrating` task with a dynamic import.

```typescript
import { Aurelia, AppTask, Registration } from 'aurelia';
import { IDatePickerService } from '@aurelia-ui/plugin-datepicker';

Aurelia.register(
  AppTask.hydrating(IContainer, async container => {
    // Loaded only when the task runs — code-split by the bundler
    const { DatePickerService } = await import(
      '@aurelia-ui/plugin-datepicker/services/date-picker'
    );
    container.register(Registration.singleton(IDatePickerService, DatePickerService));
  })
);
```

This collapses the plugin into its own chunk; the main bundle no longer
references it at startup.

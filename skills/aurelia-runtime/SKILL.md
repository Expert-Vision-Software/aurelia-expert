---
name: aurelia-runtime
description: Use when wiring an Aurelia v2 component — resolves dependency injection, routing, navigation, AppTasks, custom events, and cross-feature orchestration. Use when injecting services, configuring `@route`, navigating programmatically, sharing state between features, declaring AppTasks, or paginating components. Leading word — resolve.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: runtime
  sub-areas: di, routing, events-tasks, orchestration
  leading-word: resolve
  ground-truth: "https://docs.aurelia.io"
---

# aurelia-runtime

Resolve the wiring of an Aurelia v2 component: injection, routes, lifecycle, cross-feature flows.

## The resolve step

Every wiring problem starts the same way: identify what to resolve first, then resolve this through `resolve(Token)`. Prefer `resolve()` over the `@inject` decorator — `@inject` still works but `resolve()` is the modern v2 idiom.

| Need | Resolve |
|------|---------|
| Service | `resolve(IFoo)` |
| Route navigation | `resolve(IContextRouter)` / `resolve(IRouter)` |
| Component-scoped state | `resolve(newInstanceForScope(...))` |
| Deferred / circular | `resolve(lazy(...))` |
| Plugin collection | `resolve(all(...))` |
| Optional fallback | `resolve(optional(...))` |

The resolve step in a class is `constructor(private readonly svc: IFoo = resolve(IFoo))` for testability. Unit tests pass mocks through the constructor.

## V1 contamination — do not resolve these

These belong to Aurelia 1; they throw or silently break v2:

- `@inject` decorator → prefer `resolve()` (still valid but `resolve()` is idiomatic v2)
- `configureRouter` → use `@route`
- `PLATFORM.moduleName` → gone; use `@customElement` `dependencies` or `() => import(...)` in route `component`
- `<router-view>` → use `<au-viewport>`
- `<compose view-model>` → use `<au-compose>` with `component`
- `.delegate` (any event) and `.call` are removed → throws **AUR0713** at compile time; use `.trigger` / lambdas
- `activate` / `deactivate` hooks → use `canLoad` / `loading` / `canUnload` / `unloading`

## Non-negotiables

Override any earlier reading.

- **Event listeners**: `.trigger` only (`.delegate`/`.call` are removed — AUR0713 at compile time).
- **Type imports**: `import type` / `export type` for interfaces — interfaces are erased at runtime.
- **Singleton DI**: prefer singletons over `IEventAggregator` for cross-feature state.
- **Service returns Model**: services expose Models, never DTOs; convert via `Model.fromDTO()` / `model.toDTO()`.
- **I-prefix tokens**: `IUserService`, `IApiClient` — semantic prefix for "interface token".
- **Constructor injection**: `constructor(private readonly svc: IFoo = resolve(IFoo))` for testability.

## Orchestration: the four primitives

Resolve cross-feature wiring with these four interlocking primitives:

1. **Bindables down** — parent pushes state via `@bindable`.
2. **Custom event up** — child fires `.trigger`; parent handles via `on-event.trigger="handler($event.detail)"`.
3. **Service-as-store** — singleton DI service owns shared state; components `resolve` it.
4. **Thin page component** — page is a mediator; no business logic in the page itself.

See [reference/orchestration.md](reference/orchestration.md) for the full pattern.

## Reference

Each reference file covers one sub-area. Load the one that matches the question.

- **DI** — `resolve()`, `DI.createInterface`, registration lifecycles, advanced resolvers → [reference/di.md](reference/di.md)
- **Routing & navigation** — `@route`, `<au-viewport>`, `IContextRouter`, route parameters with `mergeStrategy`, lifecycle guards → [reference/routing.md](reference/routing.md)
- **Events & tasks** — AppTask phases (`creating` / `hydrating` / ...), `TaskQueue`, `.trigger`/`.capture` listeners, event modifiers → [reference/events-tasks.md](reference/events-tasks.md)
- **Cross-feature orchestration** — thin-page mediator, bindables down / events up, service-as-store → [reference/orchestration.md](reference/orchestration.md)

## Ground truth

- https://docs.aurelia.io
- `aurelia/aurelia` on GitHub (DeepWiki available)
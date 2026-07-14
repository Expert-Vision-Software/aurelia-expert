# Events & tasks reference

Resolve lifecycle ordering and cross-cutting concerns through AppTask phases and the TaskQueue.

## AppTask phases

`AppTask.X(I...)` runs once during framework startup, scoped to a phase:

| Phase | Runs | Use for |
|-------|------|---------|
| `creating` | Last chance to register dependencies before root component instantiation | Env config, default registrations |
| `hydrating` | After root view instantiated, before child compilation | Dynamic `import()` of feature code |
| `hydrated` | After root self-hydration | Telemetry, global state, logging init |
| `activating` | Scope hierarchy formed | Role-based feature loading |
| `activated` | App fully running | Post-startup kicks (analytics session start) |
| `deactivating` | Save state | Persist UI state before shutdown |
| `deactivated` | Final cleanup | Release last resources |

```typescript
import { AppTask, Registration } from 'aurelia';

Aurelia.register(
  // Last chance to wire dependencies — env config typically here.
  AppTask.creating(IContainer, container => {
    const config = process.env.NODE_ENV === 'production' ? prod : dev;
    Registration.instance(IApiConfig, config).register(container);
  }),

  // Dynamic feature code, lazy-loaded.
  AppTask.hydrating(IContainer, async container => {
    const featureFlags = await import('./config');
    Registration.instance(IFeatureFlags, featureFlags.default).register(container);
  }),

  // Telemetry once hydrated.
  AppTask.hydrated(IAnalytics, analytics => analytics.start()),
);
```

`AppTask.creating` is the right default for environment-specific config. `AppTask.hydrating` for lazy `import()` of feature modules. `AppTask.hydrated` for telemetry hooks.

## TaskQueue primitives

For ad-hoc scheduling inside the framework:

```typescript
import { queueTask, queueAsyncTask, queueRecurringTask } from 'aurelia';

// Microtask: runs on the next microtask tick.
queueTask(() => this.compute());

// Async task: returns the promise.
const data = await queueAsyncTask(() => fetch('/api'));

// Recurring: rerun on every microtask tick until cancelled.
const cancel = queueRecurringTask(() => this.poll());
cancel();
```

Use these instead of `setTimeout` / `Promise.resolve().then()` when you need the framework to coordinate flush timing (binding, rendering).

## Custom events: `.trigger`, not `.delegate`

Custom events fire with `.trigger`. `.delegate` for custom events throws **AUR0713** at compile time.

```html
<!-- ✅ Custom event — .trigger -->
<nav nav-click.trigger="handleNav($event)"></nav>

<!-- ❌ AUR0713 — .delegate on custom event (compile-time error) -->
<nav nav-click.delegate="handleNav($event)"></nav>
```

Native DOM events still use `.delegate` (or `@event`):

```html
<button @click="onClick()">Click me</button>
<input @keydown.enter.prevent="onEnter()">
```

The split exists because `.trigger` dispatches the custom event through Aurelia's event system; `.delegate` uses native DOM bubbling, which does not match custom event semantics in v2.

## Event modifiers

Append to native event bindings with `:`:

| Modifier | Example | Purpose |
|----------|---------|---------|
| `:capture` | `@click.capture` | Handle in capture phase |
| `:delegate` | `@click.delegate` | Native DOM event (default for `@event`) |
| `:self` | `@click.self` | Fire only when target is element itself |
| `:stop` | `@click.stop` | Stop propagation |
| `:prevent` | `@click.prevent` | `preventDefault()` |
| `:ctrl+enter` | `@click:ctrl+enter.prevent` | Key combos |

```html
<input
  type="text"
  value.bind="userInput"
  @keydown.enter.prevent="onEnter()"
  @click:ctrl+enter="onCtrlEnter()" />
```

## Anti-pattern: Event Aggregator

`IEventAggregator` is **discouraged**. Use a singleton DI service exposing typed methods instead.

| Problem | Impact |
|---------|--------|
| Implicit dependencies | Hard to find subscribers |
| Untyped payloads | `any` breaks type safety |
| Difficult debugging | Event flow unclear in stack traces |
| Undeclared coupling | Not visible in component constructors |

Use `IEventAggregator` only when many unrelated subscribers truly need the same signal AND no service is a natural home — for example, application-wide keyboard shortcuts.

## V1 contamination

- `.delegate` for custom events → throws AUR0713 at compile time; use `.trigger`.

## Ground truth

- `aurelia/aurelia/blob/master/packages/runtime-html/docs/app-tasks.md`
- `aurelia/aurelia/blob/master/packages/runtime/docs/task-queue.md`
- `aurelia/aurelia/blob/master/packages/runtime-html/docs/event-handling.md`
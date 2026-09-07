# Components

The view-model + template pair. Covers custom element naming, `bindable` props, the `dependencies` array, and the runtime rules the v2 compiler expects.

## File layout (recap)

One component = one folder or one flat namespace with **two siblings of the same base name**:

```
src/components/user-profile/
├── user-profile.ts        # view-model class
└── user-profile.html      # template
```

The runtime resolves them by basename. Do not pass `template:` to `@customElement` — see "Pairing convention" below.

## The naming rule (kebab-case mandatory)

Every custom element name must contain a hyphen. Web Components spec requires it; Aurelia enforces it.

- ✅ `user-profile`, `nav-bar`, `todo-item`, `app-shell`
- ❌ `userProfile`, `UserProfile`, `profile`, `app`, `loginbutton` (no hyphen)

The class name itself stays PascalCase (`UserProfile`); only the tag name is kebab-case:

```typescript
import { customElement, bindable } from 'aurelia';

@customElement('user-profile')     // tag: kebab-case
export class UserProfile {         // class: PascalCase
  @bindable public userId: string = '';
}
```

Used in templates as `<user-profile user-id.bind="...">`. Aurelia converts `userId` → `user-id` for attribute access automatically.

## The pairing convention (manual override forbidden)

The build resolves `name.ts` ⇄ `name.html` automatically. Adding a `template:` field to `@customElement` is a hard prohibition — it breaks the convention, defeats the build's tree-shaking, and surprises every agent.

```typescript
// ✅ CORRECT — convention does the pairing
@customElement('hello')
export class Hello {}

// ❌ FORBIDDEN — manual template override
@customElement({ name: 'hello', template: '<h1>${name}</h1>' })
export class Hello {}
```

If you need to colocate the template with the view-model, use a sibling `.html` file; if you truly need an inline template, you almost certainly want a child view-model instead.

## `@bindable` and binding modes

Mark a property `@bindable` to expose it as an HTML attribute.

```typescript
import { customElement, bindable } from 'aurelia';

@customElement('user-profile')
export class UserProfile {
  @bindable public userId: string = '';
  @bindable public readonly: boolean = false;   // read-only → use .to-view
}
```

Default mode is `.bind` (two-way). Match the mode to the intent — see the binding-modes table.

| Mode | Syntax | Direction | Default for |
|---|---|---|---|
| Two-way | `value.bind="x"` | model ↔ view | Forms (inputs) |
| To-view | `value.to-view="x"` | model → view | Read-only display |
| From-view | `value.from-view="x"` | view → model | One-way push from input |
| One-time | `value.one-time="x"` | model → view (once) | Static labels |

**.to-view is mandatory for high-frequency / real-time data** (dashboards, telemetry) to skip DOM observation. Reserve `.bind` for forms; reach for `.to-view` and `.one-time` whenever the model is the source of truth and the view is read-only.

## The `dependencies` array (encapsulation by default)

Declare every local resource the template needs in `@customElement({ dependencies: [...] })`. This keeps features self-contained and tree-shakable.

```typescript
import { customElement } from 'aurelia';
import { DateValueConverter } from './value-converters/date';
import { OrderItem } from './components/order-item';

@customElement({
  name: 'order-list',
  dependencies: [DateValueConverter, OrderItem]
})
export class OrderList {}
```

Rules:

- **Local resources go in `dependencies`.** Value converters, custom attributes, and child custom elements defined in the same feature folder belong here.
- **Global resources** (registered in the root container, e.g. via `AppTask.creating(...)`) are *not* in this array — they're ambient.
- **Bare `<import from="..." />`** inside `.html` (the alternative) is fine for one-off local children, but the `dependencies` array is preferred for *encapsulation*: it lists everything the template references at definition time, so refactors and linters can verify it.

## Service injection in components

Use `resolve()` with a constructor default. The default keeps the class testable (you can pass a mock in `new`).

```typescript
import { resolve } from 'aurelia';
import type { IUserService } from './services/user-service';

@customElement('user-profile')
export class UserProfile {
  constructor(
    private readonly userService: IUserService = resolve(IUserService)
  ) {}
}
```

Hard rules (see [SKILL.md](../SKILL.md) for the full guardrails):

- **`resolve()` over `@inject` decorator.** The `@inject` decorator still works but is deprecated; `resolve()` is the preferred v2 form. Parameter decorators inside constructors are equally forbidden.
- **`import type` for the interface, regular `import` for the DI token.** Use `import type { IUserService }` and `import { IUserService }` (the `DI.createInterface` call exports the runtime token) — or split them into separate type and value imports as the `import type` discipline requires.
- **Models, not DTOs.** Components consume `UserModel` (camelCase, `fromDTO()` converter). DTOs (PascalCase) stay inside the service layer.

## Event binding (`.trigger` for all listeners)

`.trigger` is the only event-listener command in v2.

| Form | Use for |
|---|---|
| `event.trigger="handler($event)"` | All events — custom (`<my-card save.trigger="save($event)">`) and native DOM (`@click.trigger="..."`) |
| `event.capture="handler($event)"` | Capture-phase listeners |

**Hard rule:** `.delegate` and `.call` are removed from the v2 command set — both throw `AUR0713` at compile time. Use `.trigger` for listeners and lambdas for callbacks.

```html
<!-- ✅ .trigger — custom and native events -->
<my-card save.trigger="onSave($event)"></my-card>
<button @click="onClick()">Save</button>

<!-- ❌ .delegate throws AUR0713 (compile-time error) -->
<my-card save.delegate="onSave($event)"></my-card>
```

## Dynamic CSS: prefer `.style` property binding

The build-time compiler can strip `0`, `false`, and `''` in `style="...${value}%"` interpolation, producing `style="width:{};"` in prod and a layout bug that **only shows after deploy**.

```html
<!-- ✅ Property binding — evaluated at runtime; always emits a value -->
<div width.style="pct + '%'"></div>
<div background-color.style="theme"></div>
<div style.opacity="isVisible ? '1' : '0'"></div>

<!-- ❌ Inline interpolation — prod bug; dev build masks the failure -->
<div style="width: ${pct}%"></div>
```

For multiple style props, use the object form: `<div style.bind="{ width: pct + '%', backgroundColor: theme }"></div>`.

## v1 contamination check (do not import these)

None of the following belong in a v2 component:

- `PLATFORM.moduleName(...)` — removed in v2. The convention resolves siblings.
- `configureRouter(config, router)` — use `@route` (covered in [lifecycle.md](lifecycle.md) and the router reference).
- `<router-view>` — use `<au-viewport>`.
- `<compose>` — use `<au-compose>` (and the `@compose` decorator where needed).
- `@inject` — deprecated; use `resolve()`.
- `.delegate` (any event) and `.call` — use `.trigger` / lambdas.

After scaffolding the component, jump to [lifecycle.md](lifecycle.md) for hook order and disposal rules.

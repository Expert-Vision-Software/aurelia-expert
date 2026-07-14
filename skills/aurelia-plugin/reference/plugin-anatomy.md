# Plugin Anatomy — the `register(container)` contract

A plugin is any object that exposes a `register(container: IContainer): void` method. Aurelia duck-types the contract at `Aurelia.register(...)` time — no base class, no decorator, no manifest. The minimal plugin is a plain object literal; a full plugin is a `Configuration` object returned by `.customize()`.

## The minimal plugin

```ts
import { IContainer } from '@aurelia/kernel';
export const MySimplePlugin = {
  register(container: IContainer): void {
    // register resources here
  }
};
```

## The consumer wiring

```ts
import Aurelia from 'aurelia';
import { MySimplePlugin } from './my-simple-plugin';
Aurelia.register(MySimplePlugin).app(MyApp).start();
```

`Aurelia.register(...)` returns the `Aurelia` instance for chaining, so `.app(MyApp).start()` follows directly. Multiple plugins chain: `Aurelia.register(RouterPlugin, MySimplePlugin, I18nPlugin).app(MyApp).start()`.

## The duck-typed contract

Aurelia calls `register(container)` on every argument passed to `.register(...)`. The object does not need a class, a decorator, or a known shape — only the method. This means:

- A plain object literal qualifies (minimal plugin above).
- A class with a static `register(container)` qualifies.
- A `Configuration` object returned by a `.customize()` factory qualifies (see [configuration.md](configuration.md)).
- An array of any of the above qualifies — `Aurelia.register([PluginA, PluginB])`.

The `IContainer` Aurelia passes in is the app's root container. Every resource, singleton, and token the plugin registers lands in the app's root and is visible to every component — unless the plugin deliberately scopes registration to a child container (an advanced pattern owned by `aurelia-runtime`).

## What a plugin registers

Inside `register(container)`, a plugin typically does some combination of:

1. **Registers options** — `Registration.instance(IMyPluginOptions, resolvedOptions)` so consumers can `resolve(IMyPluginOptions)`.
2. **Registers global resources** — custom elements, custom attributes, value converters, binding behaviours via `container.register(AuButton, AuCard)`.
3. **Registers DI services** — `Registration.singleton(IMyService, MyService)`.
4. **Registers AppTask hooks** — lifecycle callbacks that run at the `creating`/`hydrating`/`hydrated`/`activating`/`activated` phases.

See [configuration.md](configuration.md) for the options + AppTask patterns, and [resources.md](resources.md) for the resource + rendering patterns.

## Naming conventions

| Kind | Required pattern | Example |
| :--- | :--- | :--- |
| Export name (aggregate) | ends in `Plugin` or `Configuration` | `MyPlugin`, `MyPluginConfiguration` |
| DI options token | `I`-prefix via `DI.createInterface` | `IMyPluginOptions` |
| Custom element tag | plugin-name prefix + kebab | `my-plugin-button` |
| Custom element class | PascalCase | `AuButton` |

Export names ending in `Plugin` signal "register me as-is"; names ending in `Configuration` signal "call `.customize()` first, then register the returned object". Both are conventions, not enforcement — but following them makes the consumer's `main.ts` readable.

The DI token `I`-prefix is not cosmetic. `DI.createInterface` returns a runtime value (the token) that happens to share a name with the TypeScript interface it resolves to. The `I`-prefix distinguishes the token from plain classes and follows the same convention the framework itself uses (`IContainer`, `ILogger`, `IRendering`).

## Where to go next

- **Options, `.customize()`, AppTask hooks** → [configuration.md](configuration.md).
- **Global resources, value converters, rendering pipeline** → [resources.md](resources.md).
- **`package.json`, dual builds, `?raw` imports** → [distribution.md](distribution.md).
- **Extracting an existing library/slice/shared-dir into a plugin** → [extract.md](extract.md).
- **Naming a custom element, `@bindable`, lifecycle** → `aurelia-foundation` (scaffold).
- **DI registration mechanics, child containers** → `aurelia-runtime` (resolve).

## Review checklist

- The exported object has a `register(container: IContainer): void` method.
- The aggregate export name ends in `Plugin` or `Configuration`.
- DI tokens use `DI.createInterface` with an `I`-prefix.
- Consumer wiring is `Aurelia.register(MyPlugin).app(MyApp).start()` (chained, not split).
- The plugin does not call `Aurelia.app()` or `.start()` itself — the consumer owns the lifecycle.

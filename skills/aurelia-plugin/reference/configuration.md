# Configuration — the `.customize()` options pattern

A configurable plugin lets the consumer override defaults without editing the plugin source. The mechanism is a `DI.createInterface` token that resolves to an options object, registered via `Registration.instance(token, resolvedOptions)`. The `.customize(callback)` factory returns a fresh `Configuration` whose `register(container)` wires the user's overrides in.

v2 has no `globalResources` array and no `aurelia.use.globalResources()` — register resources via `container.register(...)` inside `register`.

## The options interface and token

```ts
import { DI } from 'aurelia';

export interface MyPluginOptions {
  readonly prefix: string;
  readonly locale: string;
  readonly cacheSize: number;
}

export const IMyPluginOptions = DI.createInterface<MyPluginOptions>(
  'IMyPluginOptions',
  builder => builder.instance({
    prefix: 'mp',
    locale: 'en',
    cacheSize: 100,
  }),
);
```

The second argument to `DI.createInterface` is the **default-initializer overload**. It registers a fallback instance that `resolve(IMyPluginOptions)` returns when the plugin's `register` has not yet overridden the token. This means a component that does `resolve(IMyPluginOptions)` never gets `undefined` — it gets the defaults, or the overridden values if `.customize()` ran first.

## The `createConfiguration` factory with `.customize()`

```ts
import { type IContainer, Registration } from 'aurelia';

export interface MyPluginConfiguration {
  register(container: IContainer): void;
  customize(callback: (options: MyPluginOptions) => void): MyPluginConfiguration;
}

export function createConfiguration(
  callback: ((options: MyPluginOptions) => void) | null,
): MyPluginConfiguration {
  return {
    register(container: IContainer): void {
      const options: MyPluginOptions = {
        prefix: 'mp',
        locale: 'en',
        cacheSize: 100,
      };
      if (callback !== null) {
        callback(options);
      }
      container.register(Registration.instance(IMyPluginOptions, options));
    },
    customize(next: (options: MyPluginOptions) => void): MyPluginConfiguration {
      return createConfiguration((options: MyPluginOptions): void => {
        callback?.(options);
        next(options);
      });
    },
  };
}

export const MyPlugin: MyPluginConfiguration = createConfiguration(null);
```

The `customize` method chains: each call wraps the previous callback, so defaults are applied first, then earlier customizations, then the latest. The final `register(container)` writes one resolved `MyPluginOptions` instance into the container.

## Consumer usage

```ts
import Aurelia from 'aurelia';
import { MyPlugin } from 'my-plugin';

Aurelia.register(
  MyPlugin.customize((options: MyPluginOptions): void => {
    options.locale = 'fr';
    options.cacheSize = 500;
  }),
).app(MyApp).start();
```

Without `.customize()`, the consumer registers the default configuration:

```ts
Aurelia.register(MyPlugin).app(MyApp).start();
```

## A component consuming the options

```ts
import { customElement, resolve } from 'aurelia';

@customElement({ name: 'mp-widget', template })
export class MpWidget {
  private readonly options: MyPluginOptions = resolve(IMyPluginOptions);

  public get label(): string {
    return `${this.options.prefix}-widget (${this.options.locale})`;
  }
}
```

The `resolve(IMyPluginOptions)` call is the functional-DI equivalent of a constructor parameter. Because the token has a default-initializer, this resolves even if `.customize()` was never called.

## AppTask lifecycle hooks

`AppTask` lets a plugin run code at a specific phase of the app lifecycle. The phases, imported from `@aurelia/runtime-html`, are:

| Phase | Fires |
| :--- | :--- |
| `AppTask.creating` | Before the root component is created |
| `AppTask.hydrating` | Before the root component is hydrated |
| `AppTask.hydrated` | After the root component is hydrated |
| `AppTask.activating` | Before the root component is activated |
| `AppTask.activated` | After the root component is activated |
| `AppTask.deactivating` | Before the root component is deactivated |
| `AppTask.deactivated` | After the root component is deactivated |

Each phase accepts a DI key to resolve and a callback (sync or async). The resolved instance is passed to the callback — this is how a plugin injects its own services into the hook.

```ts
import { AppTask, type IContainer } from 'aurelia';

export const MyPlugin: MyPluginConfiguration = createConfiguration(null);

export function createConfiguration(
  callback: ((options: MyPluginOptions) => void) | null,
): MyPluginConfiguration {
  return {
    register(container: IContainer): void {
      const options: MyPluginOptions = { prefix: 'mp', locale: 'en', cacheSize: 100 };
      if (callback !== null) {
        callback(options);
      }
      container.register(
        Registration.instance(IMyPluginOptions, options),
        Registration.singleton(ITranslationLoader, JsonTranslationLoader),
        AppTask.creating(ITranslationLoader, async (loader: ITranslationLoader): Promise<void> => {
          await loader.preload(options.locale);
        }),
        AppTask.deactivated(IContainer, (container: IContainer): void => {
          container.get(ITranslationLoader).dispose();
        }),
      );
    },
    customize(next: (options: MyPluginOptions) => void): MyPluginConfiguration {
      return createConfiguration((options: MyPluginOptions): void => {
        callback?.(options);
        next(options);
      });
    },
  };
}
```

The `creating` hook resolves `ITranslationLoader` from the container (where it was registered as a singleton one line above), then awaits `preload(locale)`. Because the callback is `async`, the app does not start until the promise resolves — the consumer's first paint is guaranteed to have translations.

The `deactivated` hook runs at teardown and disposes the loader's cache. Pair `creating`/`activated` hooks with a `deactivating`/`deactivated` cleanup to avoid leaks.

## Why no `globalResources`

v1 had `aurelia.use.globalResources(...)` and a `globalResources` array on the framework config. v2 removed both. Registration is now explicit and container-scoped:

```ts
// v1 — FORBIDDEN; does not exist in v2
aurelia.use.globalResources(PLATFORM.moduleName('./au-button'));

// v2 — CORRECT
container.register(AuButton);
```

Resources registered via `container.register(...)` inside a plugin's `register` are global — every component in the app can use them without a `<require>` or a `dependencies` array. See [resources.md](resources.md) for the full resource-registration surface.

## Where to go next

- **Global resources, value converters, rendering pipeline** → [resources.md](resources.md).
- **`package.json`, dual builds, `?raw` imports** → [distribution.md](distribution.md).
- **Minimal plugin + naming** → [plugin-anatomy.md](plugin-anatomy.md).
- **AppTask + DI mechanics in depth** → `aurelia-runtime` (resolve).

## Review checklist

- The options token uses `DI.createInterface` with the default-initializer overload so `resolve()` never returns `undefined`.
- `.customize(callback)` returns a new `Configuration`; it does not mutate the original.
- `Registration.instance(IMyPluginOptions, resolvedOptions)` runs inside `register`, after defaults and overrides merge.
- AppTask hooks are registered in the same `container.register(...)` call as the tokens they resolve.
- Every `creating`/`activating`/`hydrating` hook has a matching `deactivating`/`deactivated` cleanup if it allocates resources.
- No `globalResources` call anywhere — resources go through `container.register(...)`.

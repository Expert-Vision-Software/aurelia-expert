# DI reference

Resolve every dependency through the DI container. Never via constructor decorators.

## The token: `DI.createInterface`

`DI.createInterface` returns both the injection token and a default registration in one call.

```typescript
import { DI } from 'aurelia';

export interface IUserService {
  getUser(id: string): Promise<UserModel>;
}

// Token + default registration.
export const IUserService = DI.createInterface<IUserService>(
  'IUserService',
  x => x.singleton(UserService),
);
```

The first argument is the token's display name — it appears in DI error messages. Use the token's own name: `'IUserService'`, never `'foo'` or `'UserService'`.

Override the default at startup by registering a different concrete class against the same token:

```typescript
Aurelia.register(Registration.singleton(IUserService, MockUserService));
```

## The resolve step

`resolve()` is mandatory. Three call sites:

```typescript
import { resolve } from 'aurelia';

// 1. Class field — most common.
export class ProfilePage {
  private userService = resolve(IUserService);
}

// 2. Constructor default — for testability; pass mocks in unit tests.
export class ProfilePage {
  constructor(
    private readonly userService: IUserService = resolve(IUserService),
  ) {}
}

// 3. Inside a method — only when the dependency is genuinely conditional.
async loadAll() {
  const repo = resolve(IRepository);
  return repo.findAll();
}
```

`@inject(T1, T2)` still works but is deprecated — prefer `resolve()` field initializers.

## Registration lifecycles

| Lifecycle | When to use | Example |
|-----------|-------------|---------|
| `singleton` | Shared state, caches, API clients, route state services | `x.singleton(AuthService)` |
| `transient` | Stateless, disposable; new instance per resolve | `x.transient(ValidatorService)` |
| `instance` | Pre-built object (config object, library wrapper) registered once | `x.instance(prebuilt)` |
| `callback` | Dynamic value, called every resolve | `x.callback(() => buildX())` |
| `cachedCallback` | Expensive computation (parse base HREF); run once, cache result | `x.cachedCallback(() => parseBaseHref())` |

`cachedCallback` is the enterprise standard when initialization is expensive. `singleton` is the default for application services. Reach for `transient` only when state must not bleed across resolves.

## Advanced resolvers

Each resolver wraps a token to change resolution semantics. The wrapped token resolves the same way `resolve(Key)` does, but with the wrapped semantics.

```typescript
import { lazy, all, newInstanceForScope, optional } from 'aurelia';

export class MyComponent {
  // Deferred — ServiceA not created until getA() is called.
  // Breaks circular dependencies.
  private getA = resolve(lazy(IServiceA));

  // Collect every implementation registered against the token.
  // Plugin systems, middleware pipelines.
  private plugins = resolve(all(IPlugin));

  // One instance per component scope; disposed with the scope.
  // Use for IValidationController and other stateful, scoped services.
  private validator = resolve(newInstanceForScope(IValidationController));

  // Graceful fallback — undefined if the token is not registered.
  // Plug-in features where the app must not break on missing dependency.
  private feature = resolve(optional(IOptionalFeature));
}
```

| Resolver | Resolves to | Use case |
|----------|-------------|----------|
| `lazy(Key)` | A getter; instance created on first call | Circular dependencies, expensive services |
| `all(Key)` | Array of every registered implementation | Plugin collection, middleware chains |
| `newInstanceForScope(Key)` | A new instance per component scope | `IValidationController`, form state |
| `optional(Key)` | `undefined` if token is not registered | Optional features, graceful degradation |

## I-prefix standard

Injection tokens for interfaces use the `I` prefix: `IUserService`, `IApiClient`, `IRouteContext`. The prefix is semantic — it tells agents "interface token" from "concrete class" at a glance.

Concrete classes registered against tokens don't carry the prefix: `UserService` registers as `IUserService`.

## Disposal rules

- Singleton services that hold subscriptions (rare; `IEventAggregator` is discouraged) must clean up in the component's `unbinding` hook.
- `IValidationController` resolved via `newInstanceForScope` cleans up automatically with its scope.
- `lazy`, `all`, `optional` don't change disposal semantics — only how the instance is acquired.

## V1 contamination

`@inject` is deprecated, not removed — prefer `resolve()`. Parameter decorators inside constructors are not supported in v2 (TC39 decorators have no parameter decorators).

## Ground truth

- `aurelia/aurelia/blob/master/packages/kernel/docs/di-overview.md`
- `aurelia/aurelia/blob/master/packages/kernel/docs/di-resolvers.md`
- `aurelia/aurelia/blob/master/packages/kernel/docs/registration.md`
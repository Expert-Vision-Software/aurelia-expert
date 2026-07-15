<!-- Adapted from aurelia/skills (MIT) `references/testing.md`; canonical source aurelia/aurelia. -->

# Testing

Aurelia 2 components are tested with **Vitest** (jsdom) + `@aurelia/testing`'s `createFixture`.
This file covers the full setup plus the deep `@aurelia/testing` surface — assertions, event
helpers, mocks, async, value converters/attributes, and router testing. Storybook setup is at the
end.

This reference is the target of the testing deferrals previously pointing at a non-existent
`aurelia-testing` skill — `aurelia-ecosystem` owns component testing.

## Setup

**vitest.config.ts** — merge the app's Vite config so the Aurelia plugin and aliases apply:

```typescript
import { fileURLToPath } from "node:url";
import { mergeConfig, defineConfig, configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      watch: false,
      exclude: [...configDefaults.exclude, "e2e/*"],
      root: fileURLToPath(new URL("./", import.meta.url)),
      setupFiles: ["./test/setup.ts"],
    },
  }),
);
```

**test/setup.ts** — set the Aurelia platform once, auto-stop fixtures after each test, and polyfill
`localStorage` (Node 22+ ships an experimental `globalThis.localStorage` without `clear()`):

```typescript
import { BrowserPlatform } from '@aurelia/platform-browser';
import { setPlatform, onFixtureCreated, type IFixture } from '@aurelia/testing';
import { beforeAll, beforeEach, afterEach } from 'vitest';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(index: number): string | null { return [...this.store.keys()][index] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
  [name: string]: any;
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', { value: storage, writable: true, configurable: true });
}

function bootstrapTestEnv() {
  const platform = new BrowserPlatform(window);
  setPlatform(platform);
  BrowserPlatform.set(globalThis, platform);
}

const fixtures: IFixture<object>[] = [];
beforeAll(() => {
  bootstrapTestEnv();
  onFixtureCreated(fixture => { fixtures.push(fixture); });
});
beforeEach(() => { localStorage.clear(); });
afterEach(async () => {
  for (const f of fixtures) {
    try { await f.stop(true); } catch { /* ignore */ }
  }
  fixtures.length = 0;
});
```

## `createFixture` — two forms

**Positional:** `createFixture(template, viewModelOrClass?, registrations?, autoStart?)`.

```typescript
import { createFixture } from '@aurelia/testing';

const { appHost, component, container, assertText, started, stop } = createFixture(
  '<my-component name.bind="n"></my-component>',
  class { n = 'Alice'; },
  [MyComponent],
);
await started;            // resolves AFTER async lifecycle hooks complete
assertText('Alice', { compact: true });
await stop(true);         // stop + dispose + clean up the DOM
```

**Fluent builder** — `.html` / `.component` / `.deps` / `.config` in any order, ending in `.build()`
(at least `.html` is required):

```typescript
const { component, assertText, started, stop } = createFixture
  .component(class { greeting = 'Hello'; })
  .html`<div>${(vm: any) => vm.greeting} world</div>`
  .deps(SomeDep)
  .build();
await started;
```

The fixture object exposes: `appHost` (where the component renders — query this, not `testHost`),
`component` (root view-model), `container`, `platform`, `started`, `stop`, the assertion helpers and
event helpers below, and queries `getBy(selector)` (throws unless exactly one match),
`getAllBy(selector)`, `queryBy(selector)` (one or null).

## Assertions

The fixture returns ready-made assertions (no manual querying needed):

- `assertText(text)` / `assertText(selector, text)` — text content (`{ compact: true }` collapses whitespace)
- `assertTextContain(text)` / `assertTextContain(selector, text)`
- `assertHtml(html)` / `assertHtml(selector, html)`
- `assertValue(selector, value)` — input/form value
- `assertChecked(selector, boolean)` — checkbox/radio
- `assertClass(selector, ...classes)` / `assertClassStrict(...)`
- `assertAttr(selector, name, value)` / `assertStyles(selector, styles)`

## Triggering events & input

```typescript
const { trigger, type, component, assertText, started } = createFixture(
  '<button click.trigger="inc()">+</button><span>${count}</span>',
  class { count = 0; inc() { this.count++; } },
);
await started;
trigger.click('button');
await tasksSettled();
assertText('span', '1');
```

- `trigger.click(selector)`, `trigger.change`, `trigger.input`, `trigger.keydown`, etc., plus the
  generic `trigger(selector, eventName, init?)`.
- `type(selector, value)` sets an input's value and fires `input`.

## Awaiting updates

Always `await started` before asserting. After mutating state, flush the binding queue with
`tasksSettled` (from `@aurelia/runtime`) before asserting the DOM:

```typescript
import { tasksSettled } from '@aurelia/runtime';

component.name = 'Bob';
await tasksSettled();
assertText('Bob');
```

This also covers async lifecycle (a `binding()`/`attaching()` that returns a Promise resolves before
`started`) and is the correct wait for debounced bindings combined with fake/real timers.

## Mocks & spies

Register mock services through the 4th `createFixture` argument with `Registration.instance`
(or `.singleton`). Use your test runner's spies (`vi.fn()`):

```typescript
import { Registration } from 'aurelia';
import type { IApiService } from '../src/services/api';

const api = { getUser: vi.fn().mockResolvedValue({ name: 'Test' }) };

const { assertText, started } = createFixture(
  '<user-card></user-card>',
  {},
  [UserCard],
  [Registration.instance(IApiService, api)],
);
await started;
assertText('Test', { compact: true });
expect(api.getUser).toHaveBeenCalled();
```

`@aurelia/testing` also ships `createSpy(obj?, key?, callThrough?)` returning a spy with `.calls`,
`.reset()`, and `.restore()` if you want a dependency-free spy.

To call methods on the component under test, get its view-model with
`CustomElement.for(el).viewModel`, or use the `component` returned by the fixture when the component
is the root.

## Testing value converters, behaviors & attributes

- **Value converter / binding behavior:** unit-test the class directly (`new ToUpper().toView('x')`),
  and integration-test by registering it as a dep and asserting rendered output
  (`createFixture('<div>${v | toUpper}</div>', { v: 'hi' }, [ToUpper])`).
- **Custom attribute:** register it as a dep, apply it in the template, and assert the element's
  resulting DOM/state; trigger bindable changes via `component.x = ...` + `tasksSettled()`.

## Testing routing

Use `historyStrategy: 'none'` so tests don't mutate browser history, then drive navigation through
`IRouter`:

```typescript
import { route, IRouter, RouterConfiguration } from '@aurelia/router';

@route({ routes: [
  { path: ['', 'home'], component: () => import('./home') },
  { path: 'users/:id', component: () => import('./user') },
]})
class App {}

const { appHost, container, started, stop } = createFixture(
  '<au-viewport></au-viewport>',
  App,
  [RouterConfiguration.customize({ historyStrategy: 'none' })],
);
await started;

const router = container.get(IRouter);
await router.load('users/42');
expect(appHost.textContent).toContain('User 42');
await stop(true);
```

A `canLoad` returning a redirect path can be asserted the same way (load the guarded route, assert
the redirected component rendered). Router events are observable via `container.get(IRouterEvents)`.

## Pitfalls

- Forgetting `await started` → asserting before render/async hooks finish.
- Not calling `stop(true)` → leaked fixtures/DOM across tests. (The `test/setup.ts` above stops
  tracked fixtures in `afterEach`; still prefer explicit `stop(true)` in focused tests.)
- Asserting without `await tasksSettled()` after a state change → stale DOM.
- Querying `testHost` (the wrapper) instead of `appHost` (the component host).
- Platform not set → bootstrap `setPlatform(...)` in `test/setup.ts` (see Setup above).

## Storybook

Storybook (for visual component development) uses the `@aurelia/storybook` framework on the Vite
builder. Only add it when the app actually uses it.

**.storybook/main.ts**:
```typescript
import type { StorybookConfig } from 'storybook/internal/types';
import { mergeConfig, type InlineConfig } from 'vite';

const config: StorybookConfig & { viteFinal?: (config: InlineConfig) => InlineConfig | Promise<InlineConfig> } = {
  stories: ['../src/**/*.stories.@(ts|tsx|js|jsx|mdx)'],
  addons: ['@storybook/addon-links'],
  framework: { name: '@aurelia/storybook', options: {} },
  core: { builder: '@storybook/builder-vite' },
  viteFinal: async (viteConfig) => {
    viteConfig.optimizeDeps = viteConfig.optimizeDeps || {};
    viteConfig.optimizeDeps.exclude = viteConfig.optimizeDeps.exclude || [];
    if (!viteConfig.optimizeDeps.exclude.includes('@aurelia/runtime-html')) {
      viteConfig.optimizeDeps.exclude.push('@aurelia/runtime-html');
    }
    return mergeConfig(viteConfig, {});
  },
};
export default config;
```

**.storybook/preview.ts**:
```typescript
export { render, renderToCanvas } from '@aurelia/storybook';
```

<!-- Adapted from aurelia/skills (MIT) `references/state.md`; canonical source aurelia/aurelia. -->

# `@aurelia/state` — Redux-style State Management

`@aurelia/state` is a lightweight, Redux-like store integrated with Aurelia's binding system: a
single immutable state tree, action dispatch, and reducer-style action handlers. Import from
`@aurelia/state`.

Reach for it when multiple, unrelated components need to share and react to the same state. For
simple parent↔child data flow, prefer `@bindable`; for loose pub/sub, prefer the EventAggregator.
This package's guardrail prefers singleton DI services over an EA bus for cross-component state —
`@aurelia/state` is the right escalation when a service-as-store is not enough.

## Registration

Register `StateDefaultConfiguration.init(initialState, ...handlers)` in `main.ts`.

```typescript
import Aurelia from 'aurelia';
import { StateDefaultConfiguration } from '@aurelia/state';
import { MyApp } from './my-app';

const initialState = { keywords: '', items: [] as string[] };

function searchHandler(state, action) {
  switch (action.type) {
    case 'updateKeywords': return { ...state, keywords: action.value };
    case 'setItems':       return { ...state, items: action.payload };
    default:               return state;
  }
}

Aurelia
  .register(StateDefaultConfiguration.init(initialState, searchHandler))
  .app(MyApp)
  .start();
```

An **action handler** has the signature `(state, action) => newState` (may return a `Promise`). It
must return a **new** state object (never mutate), and return the current `state` unchanged for
actions it does not handle. Multiple handlers run in sequence.

## Template bindings

The plugin registers two binding commands and one binding behavior:

- **`.state`** — bind a target to a value derived from the store state.
- **`.dispatch`** — dispatch an action object on a DOM event.
- **`& state`** — read a state value inside any interpolation/binding expression.

```html
<!-- value.state binds the input to state.keywords; input.dispatch sends an action -->
<input value.state="keywords"
       input.dispatch="{ type: 'updateKeywords', value: $event.target.value }">

<button click.dispatch="{ type: 'setItems', payload: [] }">Clear</button>

<!-- & state reads state values in expressions -->
<p>Searching for "${keywords & state}" — ${items.length & state} results</p>
<ul>
  <li repeat.for="item of items & state">${item}</li>
</ul>
```

Inside `.state` / `& state` expressions, the state tree is the binding scope; use `$parent` to
reach the owning view-model.

## Accessing the store from a view-model

Resolve `IStore` to dispatch and read state imperatively.

```typescript
import { resolve } from 'aurelia';
import { IStore } from '@aurelia/state';

export class SearchBox {
  private store = resolve(IStore);

  search(term: string) {
    this.store.dispatch({ type: 'updateKeywords', value: term });
  }

  get current() {
    return this.store.getState();
  }
}
```

`IStore` methods: `dispatch(action)` (returns `void | Promise<void>`), `getState()`,
`subscribe(subscriber)` / `unsubscribe(subscriber)` where a subscriber is
`{ handleStateChange(state, prevState) {} }`.

## `@fromState` decorator

Bind a view-model property to a slice of state via a selector — handy for use in TypeScript logic
rather than templates.

```typescript
import { fromState } from '@aurelia/state';

export class Results {
  @fromState(state => state.items)
  items!: string[];

  @fromState(state => state.keywords)
  keywords!: string;
}
```

For derived values, `createStateMemoizer` avoids recomputing on unrelated state changes:

```typescript
import { fromState, createStateMemoizer } from '@aurelia/state';

const selectCount = createStateMemoizer(
  (s: State) => s.items,
  items => items.length,
);

export class Counter {
  @fromState(selectCount) count!: number;
}
```

## Gotchas

- Always return a new object from handlers (`{ ...state, ... }`); mutation breaks change detection
  and DevTools.
- Return the unchanged `state` (not `undefined`) for unhandled actions.
- There is **no `|` value converter** for state — use the `& state` binding behavior.
- Type the action union on `IStore<TState, TAction>` for compile-time checked `dispatch` calls.
- If you `subscribe(...)` imperatively, unsubscribe in `dispose` (permanent teardown), not
  `unbinding` — the same disposal rule that applies to `IEventAggregator`.
- Redux DevTools is auto-detected; configure via the options object passed to `.init(...)`.

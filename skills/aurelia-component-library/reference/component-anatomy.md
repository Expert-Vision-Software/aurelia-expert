# Component Anatomy

The contract every library element honours: view-model + template pair, kebab tag, `@bindable` variants/sizes, a computed class list, `<au-slot>` projection in Light DOM, `.style` property binding for dynamic CSS, and a token-driven `.css`. The complete `ui-button` is the canonical example; every other library component mirrors its shape.

## Anatomy rules (mandatory)

1. **Tag is `ui-*` kebab.** The class is `Ui*` PascalCase. Web Components require a hyphen; this is enforced by Aurelia's compiler.
2. **No `template:` override on `@customElement`.** The `name.ts` + `name.html` pairing convention does the job.
3. **`@bindable` for every variant, size, state, and event-arg prop.** Default values are mandatory so unrendered attributes are still well-typed.
4. **`export type` the unions, runtime-import the class.** Consumers see variant strings as types, not magic strings.
5. **Class list built in the view-model** (a getter or a method), not interpolated in the template. Pairing `class="ui-button--${variant}"` with `class.bind` does not work; emit the full string instead.
6. **`<au-slot>` for projection**, not bare `<slot>`. `<slot>` requires `shadowOptions: { mode: 'open' }` (see `aurelia-migration/reference/debugging.md`, AUR0717). Light DOM is the default — only opt into Shadow DOM when style isolation is a hard requirement.
7. **`.to-view` for read-only bindables** (label, disabled, current) — skips DOM observation for high-frequency or `false`/`0`/`''` values. Use default `.bind` only for forms (text inputs, textareas, selects).
8. **`.style` property binding for dynamic CSS**, never inline `style="width: ${pct}%"`. Inline interpolation compiles to `style="width:{};"` for `0`/`false`/`''` in production (a dev-build-hidden bug).
9. **`.trigger` for all event listeners**, never `.delegate` — `.delegate` is removed for every event type and throws AUR0713 at compile time.

## The `ui-button` sample — view-model

```typescript
import { customElement, bindable } from 'aurelia';
import './ui-button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@customElement('ui-button')
export class UiButton {
  @bindable public variant: ButtonVariant = 'primary';
  @bindable public size: ButtonSize = 'md';
  @bindable public type: 'button' | 'submit' | 'reset' = 'button';
  @bindable public disabled: boolean = false;
  @bindable public block: boolean = false;

  public get classNames(): string {
    return [
      'ui-button',
      `ui-button--${this.variant}`,
      `ui-button--${this.size}`,
      this.block ? 'ui-button--block' : '',
    ]
      .filter((token: string) => token.length > 0)
      .join(' ');
  }
}
```

## The `ui-button` sample — template

```html
<template>
  <button
    type.to-view="type"
    disabled.to-view="disabled"
    class.bind="classNames"
  >
    <au-slot></au-slot>
  </button>
</template>
```

`type` and `disabled` use `.to-view` — the parent owns the model value; the button reflects it. Only form-bound inputs use `.bind`.

## The `ui-button` sample — stylesheet

Every value references `--au-*` tokens; none are raw.

```css
.ui-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--au-space-2);
  border: 0;
  border-radius: var(--au-radius-md);
  font-family: var(--au-font-sans);
  font-weight: var(--au-font-weight-medium);
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--au-duration-fast) var(--au-ease-standard);
}

.ui-button:disabled {
  opacity: var(--au-opacity-disabled);
  cursor: not-allowed;
}

.ui-button--primary {
  background-color: var(--au-color-action);
  color: var(--au-color-action-contrast);
}
.ui-button--primary:hover {
  background-color: var(--au-color-action-hover);
}

.ui-button--secondary {
  background-color: var(--au-color-surface-muted);
  color: var(--au-color-text);
}

.ui-button--ghost {
  background-color: transparent;
  color: var(--au-color-action);
}

.ui-button--danger {
  background-color: var(--au-color-danger);
  color: var(--au-color-action-contrast);
}
.ui-button--danger:hover {
  background-color: var(--au-color-danger-hover);
}

.ui-button--sm { padding: var(--au-space-1) var(--au-space-2); font-size: var(--au-font-size-sm); }
.ui-button--md { padding: var(--au-space-2) var(--au-space-4); font-size: var(--au-font-size-md); }
.ui-button--lg { padding: var(--au-space-3) var(--au-space-6); font-size: var(--au-font-size-lg); }

.ui-button--block { display: flex; width: 100%; }
```

## A second example — dynamic CSS via `.style` (the `progress` pattern)

When a value drives CSS *and* changes at runtime (progress percentage, dynamic radius, animation delay), use `.style` binding.

```typescript
@customElement('ui-progress')
export class UiProgress {
  @bindable public value: number = 0;
}
```

```html
<template>
  <div class="ui-progress" role="progressbar" aria-valuenow.bind="value">
    <div class="ui-progress__bar" width.style="value + '%'"></div>
  </div>
</template>
```

```css
.ui-progress {
  width: 100%;
  height: var(--au-space-1);
  background-color: var(--au-color-surface-muted);
  border-radius: var(--au-radius-sm);
  overflow: hidden;
}
.ui-progress__bar {
  height: 100%;
  background-color: var(--au-color-action);
  transition: width var(--au-duration-fast) var(--au-ease-standard);
}
```

`width.style="value + '%'"` always emits a string at runtime — there is no prod-build silent-zero bug like there is with inline `style="width: ${value}%"`.

## Custom events emitted by library components

Library components that raise custom events (e.g. `ui-modal` raising `close`) declare them with the `Event` constructor in the view-model and bind via `.trigger` in templates:

```typescript
public readonly close: Event = new Event('close');

public dismiss(): void {
  this.close.dispatch();
}
```

```html
<ui-modal close.trigger="handleClose($event)">...</ui-modal>
```

The companion side of the rule is the rule above: `.trigger` is mandatory for custom events.

## Review checklist

- Tag is `ui-*` kebab; class is `Ui*` PascalCase.
- `name.ts` imports `name.css`; no inline `<style>` in the template; no `template:` field.
- Every variant/size/state is `@bindable` with a default; unions are `export type`.
- Class list is computed in the view-model — never template interpolation.
- `<au-slot>` for projection, not bare `<slot>`.
- All form-bound `value.bind`; everything else (label, disabled, current, etc.) `.to-view`.
- Dynamic CSS via `.style` binding, never inline interpolation.
- Custom and native DOM events via `.trigger` (or the `@click` short form).
- Every CSS rule resolves to `var(--au-*)` — no raw `#hex`, `rem`, `ms`, or `px` literals.

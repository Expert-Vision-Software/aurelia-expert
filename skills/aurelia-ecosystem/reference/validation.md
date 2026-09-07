<!-- Adapted from aurelia/skills (MIT) `references/validation.md`; canonical source aurelia/aurelia. -->

# `@aurelia/validation` — Form & Model Validation

Aurelia 2 validation is split across packages:

- **`@aurelia/validation`** — the core rules engine (fluent rule API, validator, messages).
- **`@aurelia/validation-html`** — the UI layer: the `& validate` binding behavior, the validation
  controller, and the error-display custom element/attribute. **Register this one** — it pulls in
  the core.
- **`@aurelia/validation-i18n`** — optional, localizes validation messages via `@aurelia/i18n`.

## Registration

```typescript
import Aurelia from 'aurelia';
import { ValidationHtmlConfiguration } from '@aurelia/validation-html';
import { MyApp } from './my-app';

Aurelia
  .register(ValidationHtmlConfiguration)
  .app(MyApp)
  .start();
```

Customize defaults (default trigger, etc.) when needed:

```typescript
import { ValidationHtmlConfiguration, ValidationTrigger } from '@aurelia/validation-html';

ValidationHtmlConfiguration.customize(options => {
  options.DefaultTrigger = ValidationTrigger.change;   // default is focusout
});
```

## Defining rules (fluent API)

Resolve `IValidationRules` and define rules in the constructor with `.on(target).ensure(prop)`.

```typescript
import { resolve } from 'aurelia';
import { IValidationRules } from '@aurelia/validation';

export class SignupForm {
  private rules = resolve(IValidationRules);

  username = '';
  email = '';
  age: number | null = null;

  constructor() {
    this.rules
      .on(this)
      .ensure('username')
        .required()
        .minLength(3).withMessage('Username must be at least 3 characters')
      .ensure('email')
        .required()
        .matches(/^[^@]+@[^@]+\.[^@]+$/).withMessage('Enter a valid email')
      .ensure('age')
        .satisfies(v => v == null || v >= 18).withMessage('Must be 18 or older');
  }
}
```

Built-in rules: `required()`, `minLength(n)`, `maxLength(n)`, `minItems(n)`, `maxItems(n)`,
`min(n)`, `max(n)`, `range(min, max)`, `between(min, max)`, `equals(value)`, `matches(regex)`,
`satisfies(fn)` (custom predicate, may be async), `satisfiesRule(ruleInstance)`.

`email()` is deprecated — its pattern is neither RFC 5322 nor RFC 6532 compliant. Validate
addresses with `.matches(regex)` or a custom rule via `.satisfiesRule()` / `.satisfies()` backed
by an RFC-compliant parser.

Modifiers: `.withMessage(text)` (supports `$displayName`, `$value`, `$rule` placeholders),
`.withMessageKey(key)`, `.displayName(name)`, `.when(predicate)` (conditional), `.tag(tag)`
(selective validation), `.then()` (run the next rule only if the previous passed — good for gating
an expensive async check behind a cheap one).

`required()` only rejects `null`, `undefined`, and `''` — not `false` or `0`. Use `.satisfies(...)`
for strict boolean/zero checks.

## The validation controller

The controller orchestrates validation and tracks results. Create one **scoped to the form
component** with `newInstanceForScope` so the `& validate` bindings in the template find it.

```typescript
import { resolve, newInstanceForScope } from 'aurelia';
import { IValidationController } from '@aurelia/validation-html';
import { IValidationRules } from '@aurelia/validation';

export class SignupForm {
  private controller = resolve(newInstanceForScope(IValidationController));
  private rules = resolve(IValidationRules);

  username = '';
  email = '';

  constructor() {
    this.rules.on(this)
      .ensure('username').required().minLength(3)
      .ensure('email').required();
  }

  async submit() {
    const result = await this.controller.validate();
    if (result.valid) {
      // proceed
    }
  }
}
```

Child components that share the same form resolve the parent's controller with plain
`resolve(IValidationController)` (no `newInstanceForScope`).

Controller API: `validate(instruction?)` → `Promise<{ valid, results }>`, `reset(instruction?)`,
`revalidateErrors()`, `addObject(obj)` / `removeObject(obj)`, `addError(message, obj, prop?)` /
`removeError(result)`, `addSubscriber(sub)` / `removeSubscriber(sub)`. Current results are on
`controller.results` (each has `valid`, `message`, `propertyName`, `object`).

## Template: `& validate` and showing errors

Apply the `& validate` binding behavior to the bindings you want validated. Trigger forms:
`& validate` (default trigger), `& validate:'blur'`, `& validate:'change'`,
`& validate:'changeOrBlur'`, `& validate:'focusout'`, `& validate:'manual'`.

```html
<form submit.trigger:prevent="submit()">
  <input value.bind="username & validate">
  <input value.bind="email & validate:'blur'">

  <!-- Manual error list from the controller -->
  <ul>
    <li repeat.for="result of controller.results" if.bind="!result.valid">
      ${result.message}
    </li>
  </ul>

  <button type="submit">Sign up</button>
</form>
```

For per-field display, the `validation-errors` custom attribute collects a field's errors:

```html
<div validation-errors.from-view="usernameErrors">
  <input value.bind="username & validate">
  <span class="error" repeat.for="err of usernameErrors">${err.result.message}</span>
</div>
```

A ready-made `validation-container` custom element is also registered for wrapping an input plus its
error output.

## Custom rules

```typescript
import { BaseValidationRule } from '@aurelia/validation';

class UniqueEmailRule extends BaseValidationRule {
  async execute(value: string): Promise<boolean> {
    return !(await emailExists(value));   // true === valid
  }
}

// rules.on(this).ensure('email').required().then().satisfiesRule(new UniqueEmailRule());
```

## Gotchas

- "No controller found" for a `& validate` binding → the form component must create the controller
  with `resolve(newInstanceForScope(IValidationController))`.
- Register `ValidationHtmlConfiguration` (the `-html` package), not the bare core configuration.
- `required()` passes for `false`/`0`; use `satisfies` for those.
- For localized messages, register `@aurelia/i18n` first, then `ValidationI18nConfiguration`.
- Pair this with [forms.md](forms.md) for `submit.trigger:prevent` and input binding patterns.

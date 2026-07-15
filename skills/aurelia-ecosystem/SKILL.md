---
name: aurelia-ecosystem
description: Wire first-party Aurelia v2 plugins and ecosystem concerns into an app — picks the right reference for HTTP/fetch-client, validation, dialog, state, i18n, forms, testing, and SSR/prerendering. Use when adding @aurelia/fetch-client, @aurelia/validation, @aurelia/dialog, @aurelia/state, or @aurelia/i18n; writing Vitest + @aurelia/testing component tests; binding forms with model.bind/matcher.bind; or configuring server-side rendering, prerendering, hydration, sitemap/robots, and client takeover. Leading word — wire.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: ecosystem
  sub-areas: ssr, fetch-client, validation, dialog, state, i18n, forms, testing
  leading-word: wire
  ground-truth: https://docs.aurelia.io
---

# Aurelia Ecosystem — First-Party Plugins, SSR, Testing, Forms

**Wire** the runtime ecosystem into an app: the first-party plugins (`@aurelia/fetch-client`,
`@aurelia/validation`, `@aurelia/dialog`, `@aurelia/state`, `@aurelia/i18n`), forms, component
testing, and server-side rendering. Each concern has a focused reference — read the relevant one
before writing code against that package, and only register a package when the app actually needs it.

## Version & ground truth

- **Aurelia 2.x only.** v1 patterns are gone; every prohibition defers to
  [`aurelia-migration/reference/v1-removals.md`](../aurelia-migration/reference/v1-removals.md),
  the single source of truth for severity (REMOVED / DEPRECATED / error code).
- `https://docs.aurelia.io` is authoritative. DeepWiki deep-links follow the form
  `aurelia/aurelia/blob/master/packages/<pkg>/docs/<file>.md`.

## Pick a reference

Match the request to exactly one branch. Every branch lives in `reference/` and links back here.

| Request shape | Reference |
|---|---|
| "SSR", "prerender", "hydrate", "SEO render", "sitemap/robots", "client takeover" | [reference/ssr.md](reference/ssr.md) |
| "HTTP client", "fetch-client", `IHttpClient`, interceptors, retry, cancellation | [reference/fetch-client.md](reference/fetch-client.md) |
| "validation", `IValidationController`, `& validate`, fluent rules | [reference/validation.md](reference/validation.md) |
| "dialog", "modal", `IDialogService.open()`, `IDialogController` | [reference/dialog.md](reference/dialog.md) |
| "state store", `@aurelia/state`, `.state`/`.dispatch`, `@fromState`, Redux-style | [reference/state.md](reference/state.md) |
| "i18n", "translate", "locale", `@aurelia/i18n`, `t` attribute, `nf`/`df`/`rt` | [reference/i18n.md](reference/i18n.md) |
| "form", "checkbox", "radio", "select", `model.bind`, `matcher.bind`, `submit.trigger` | [reference/forms.md](reference/forms.md) |
| "test", "Vitest", `createFixture`, `@aurelia/testing`, mocks, router tests, Storybook | [reference/testing.md](reference/testing.md) |

If the request spans two references (e.g. "a validated form"), start with [forms.md](reference/forms.md)
and follow its outbound link to [validation.md](reference/validation.md).

## Hard guardrails (apply to every branch)

These extend the package-wide guardrails (`.trigger`, kebab-case, `import type`, `.style`, singleton
DI over Event Aggregator, Models not DTOs) with ecosystem-specific rules:

- **`resolve()` for DI.** Inject plugin services (`IHttpClient`, `IDialogService`, `IStore`, `I18N`,
  `IValidationController`) as class-field initializers. `@inject` is DEPRECATED — still valid, but
  `resolve()` is the package default. See `v1-removals.md`.
- **Scoped controllers via `newInstanceForScope`.** A form's `IValidationController` must be created
  with `resolve(newInstanceForScope(IValidationController))` so `& validate` bindings find it.
- **Dispose `IEventAggregator` subscriptions in `dispose`**, not `unbinding`. `dispose` is the
  mandatory permanent-teardown hook; `unbinding` runs before potential reactivation. The i18n
  locale-change subscription and any EA listener follow this rule.
- **Register the `-html` / Standard configuration.** Validation: register
  `ValidationHtmlConfiguration` (pulls in the core). Dialog: prefer `DialogConfigurationStandard`
  (native `<dialog>`, modal by default).
- **`submit.trigger` does NOT `preventDefault`.** Use `submit.trigger:prevent="..."` or the form
  reloads the page. See [forms.md](reference/forms.md).
- **`.style` property binding when a value can be falsy.** Inline `style="width: ${value}%"` is safe
  only for guaranteed non-falsy values; the prod optimizer drops falsy placeholders. Prefer
  `width.style="expr"`. Narrow rule — see `aurelia-migration/reference/debugging.md`.
- **Peer dependencies are real.** `@aurelia/i18n` needs `i18next` installed; `aurelia2-ssr` needs
  `jsdom`. The `aurelia` meta-package already bundles `@aurelia/fetch-client`.

## SSR is a first-class branch

SSR/prerendering is the largest single gap this pillar closes. Before editing any SSR code —
`renderAureliaToString`, takeover, hydration, sitemap — read [reference/ssr.md](reference/ssr.md).
Default to **prerender + `mode: 'remount'`** takeover unless a core-compatible SSR manifest and
AOT-ready definitions are present (true `hydrate` requires matching marker comments, an `ISSRScope`
tree, and compatible definitions).

## Defers to sibling skills

- Authoring a custom element / lifecycle / DI token from scratch → `aurelia-foundation` and
  `aurelia-runtime`.
- Structuring a large app that consumes these plugins (feature slices, shared registration) →
  `aurelia-largespa`.
- v1 → v2 API translation and removed-API troubleshooting → `aurelia-migration`.
- Packaging any of these plugins (or a library built on them) for npm → `aurelia-plugin`.

## Lead with `wire`

Use the verb *wire* to anchor each ecosystem action: *wire the HTTP client*, *wire validation*,
*wire the dialog service*, *wire the store*, *wire i18n*, *wire SSR*, *wire the test harness*. The
shared vocabulary keeps the agent inside Aurelia's first-party surface, not a generic fetch/Zod stack.

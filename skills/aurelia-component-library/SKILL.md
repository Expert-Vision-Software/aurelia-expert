---
name: aurelia-component-library
description: Assemble a styled, variable-driven component library on Aurelia v2 + Tailwind — either deploy the canonical structure into a new app or extract existing components into a shared UI kit. Covers the design-token layer (CSS custom properties on the root element plus the Tailwind @theme bridge), the shared/components/ui/ library layout with the ui- element prefix, component anatomy (bindable variants, <au-slot> projection in Light DOM, .style property binding), the greenfield deploy procedure, and the migrate-existing procedure. Leading word — assemble.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: component-library
  sub-areas: tokens, library-layout, component-anatomy, greenfield, migrate
  leading-word: assemble
  ground-truth: https://docs.aurelia.io
  requires: aurelia-expert (router)
---

# aurelia-component-library

**Assemble** a styled, variable-driven, reusable component library on Aurelia v2 + Tailwind. This skill owns two movements:

1. **Assemble from scratch** — drop the canonical token layer + library structure into a new or existing Aurelia app.
2. **Assemble from existing code** — extract already-written components into that structure, renaming and tokenizing as you go.

The library is a web-standards layer. Design tokens are **CSS custom properties** (a DOM/CSS primitive, not a proprietary abstraction), consumed by Tailwind utilities through a single `@theme` bridge. One source of truth, two faces.

## Pick a reference

Match the request to exactly one branch. Every branch lives in `reference/` and links back here.

| Request shape | Reference |
|---|---|
| "design tokens", "CSS variables", "theme switching", "dark mode" | [reference/tokens.md](reference/tokens.md) |
| "where does the library live", "folder layout", "barrel", "Shared.register", "ui- prefix" | [reference/library-layout.md](reference/library-layout.md) |
| "anatomy of a library component", "variants", "sizes", "<au-slot>", "button sample" | [reference/component-anatomy.md](reference/component-anatomy.md) |
| "create a library from scratch", "deploy the structure into my app" | [reference/greenfield.md](reference/greenfield.md) |
| "extract existing components into a library", "move shared buttons into a kit" | [reference/migrate.md](reference/migrate.md) |

If the request spans structure and tokens, start with [library-layout.md](reference/library-layout.md) and follow its outbound link to [tokens.md](reference/tokens.md).

## Hard guardrails (non-negotiable)

These compound the foundation guardrails with the library's own. Ignoring any is a silent prod bug or a fractured token source.

- **Tokens are CSS custom properties.** One file (`src/styles/tokens.css`) owns the `--au-*` variables on the root element. Tailwind's `@theme` block *bridges* to those variables (`--color-action: var(--au-color-action)`); it never re-declares a raw value. Two sources of truth means a theme that half-switches.
- **Library under `shared/components/ui/`.** The `ui-` kebab prefix is mandatory for every library element (`ui-button`, `ui-card`); the class is `Ui*` PascalCase. Register every `Ui*` globally via `Shared.register(container)`. The `shared/` admission rule itself is owned by `aurelia-largespa` — this skill narrows it to the `ui/` layer.
- **Light DOM + `<au-slot>`.** Bare `<slot>` requires `shadowOptions`; default to Light DOM so global tokens cascade and Tailwind applies without extra config. Reserve Shadow DOM for components that must style-isolate.
- **Variants/sizes via `@bindable`, class list in the view-model.** Never interpolate `class="ui-button--${variant}"` alongside `class.bind`; compute the full class string in a getter so it is token-driven and debuggable.
- **`.style` property binding for dynamic CSS.** Inline `style="width: ${value}%"` compiles to `style="width:{};"` for `0`/`false`/`''` in production. Use `width.style="expr"`.
- **`import type` for variant unions.** `export type ButtonVariant = ...` is type-only; the `Ui*` class is the runtime import.

## What this skill defers

- **Overall feature-first layout and the `shared/` admission rule** → `aurelia-largespa` (slice). This skill consumes the `shared/` convention; it does not redefine it.
- **Custom-element naming, `@bindable` mechanics, lifecycle** → `aurelia-foundation` (scaffold).
- **v1 → v2 conversion of legacy source** → `aurelia-migration` (lift). If the components you are extracting are v1, **lift first** (run the v1-removals table), then assemble the lifted v2 code into the library. Never tokenize v1 code in place.
- **DI registration mechanics (`Registration.singleton`, child containers)** → `aurelia-runtime` (resolve) and `aurelia-largespa` (feature-module).

## Lead with `assemble`

Use the verb *assemble* to anchor each action: *assemble the token layer*, *assemble the library layout*, *assemble a component*, *assemble from existing code*. The shared vocabulary keeps the agent's mental model on the deliverable — a cohesive, token-driven UI kit — not on ad-hoc styling.

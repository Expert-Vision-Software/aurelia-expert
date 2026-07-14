---
name: aurelia-foundation
description: Scaffold an Aurelia v2 project from zero. Picks the right foundation step — philosophy, hello-world quickstart, component naming, lifecycle hooks, or AI-assisted scaffolding. Use when starting an Aurelia 2 app, asking "what is Aurelia", creating a custom element, wiring binding/attached/unbinding, or generating the first main.ts and pair.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: foundation
  sub-areas: philosophy, quickstart, components, lifecycle, ai-tooling
  leading-word: scaffold
  ground-truth: https://docs.aurelia.io
---

# aurelia-foundation

Scaffold the **first decision** for any Aurelia v2 task: pick the right foundation reference. Aurelia's reference documentation is opinionated; the wrong pillar at the wrong time costs more than picking the right one.

## Version & ground truth

- **Aurelia 2.x only.** v1 patterns are gone (details in each reference).
- `https://docs.aurelia.io` is authoritative. DeepWiki deep-links follow the form `aurelia/aurelia/blob/master/packages/<pkg>/docs/<file>.md`.

## Pick a reference

Match the request to exactly one branch. Every branch lives in `reference/` and links back here.

| Request shape | Reference |
|---|---|
| "What is Aurelia?", "why Aurelia over React?", "is Aurelia stable?" | [reference/philosophy.md](reference/philosophy.md) |
| "Scaffold a new project", "hello world", "first `main.ts`", "make aurelia my-app" | [reference/quickstart.md](reference/quickstart.md) |
| "Create a custom element", "kebab-case name", "bindable", "dependencies array" | [reference/components.md](reference/components.md) |
| "`binding` / `attached` / `unbinding`", "lifecycle order", "dispose subscriptions" | [reference/lifecycle.md](reference/lifecycle.md) |
| "Use an AI to scaffold this", "DHB prompts", "NotebookLM ground truth" | [reference/ai-tooling.md](reference/ai-tooling.md) |

If the request spans two pillars (e.g. "scaffold a custom element with lifecycle"), start with the scaffolding reference ([quickstart](reference/quickstart.md) or [components](reference/components.md)) and follow its outbound links to the second.

## Hard guardrails (apply to every branch)

These are non-negotiable across all four pillars. Each is enforced by the runtime or build pipeline; ignoring any of them is a runtime error or a silent prod bug.

- **`.trigger` for custom events.** `.delegate` on a custom event throws `AUR0009`. Use `.delegate` only on native DOM events.
- **Kebab-case element names.** Every custom element name must contain a hyphen (`user-profile`, not `userProfile`).
- **`import type` / `export type` for interfaces.** Interfaces are type-only; runtime values use regular `import` / `export`. Project enforces via `verbatimModuleSyntax: true` in `tsconfig.json`.
- **`.style` property binding for dynamic CSS.** Inline `style="width: ${value}%"` compiles to `style="width:{};"` when the value is `0`/`false`/`''` in production. Use `width.style="expr"` so the runtime JS expression always emits a value.
- **Singleton DI services over Event Aggregator.** Prefer typed, constructor-injected services for cross-component state. `IEventAggregator` exists but is a last resort; the `unbinding` hook is the hard mandate disposal site if you do subscribe.
- **Models, not DTOs, cross the service boundary.** Services return Model classes (camelCase, `*.model.ts`). DTOs (PascalCase, `*-dto.ts`) live in `src/models/` and convert via `Model.fromDTO()`. Components consume Models, never DTOs.

Each guardrail is expanded in the reference file closest to it (template/binding → [components](reference/components.md); naming → [components](reference/components.md); state → [lifecycle](reference/lifecycle.md)).

## Lead with `scaffold`

Use the verb *scaffold* to anchor each foundation action: *scaffold the project*, *scaffold a custom element*, *scaffold the lifecycle*, *scaffold the agent prompt*. The shared vocabulary keeps the agent's mental model inside Aurelia's, not React's.

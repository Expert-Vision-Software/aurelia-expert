---
name: aurelia-plugin
description: Package a distributable Aurelia v2 plugin — author the register(container) entry point, the .customize() options pattern with DI.createInterface tokens, global resource registration, AppTask lifecycle hooks, and the rendering-pipeline extensions (IRenderer, IRendering, registerHostNode). Use when creating a plugin from scratch, turning a component library, feature slice, or shared directory into a standalone npm package, wiring peerDependencies and dual ESM/CJS builds, or shipping templates/styles with explicit ?raw imports. Leading word — package.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: plugin
  sub-areas: plugin-anatomy, configuration, resources, distribution, extract
  leading-word: package
  ground-truth: https://docs.aurelia.io
  requires: aurelia-expert (router)
---

# aurelia-plugin

**Package** a distributable Aurelia v2 plugin — a standalone npm unit that any Aurelia app registers via `Aurelia.register(MyPlugin)`. This skill owns five movements:

1. **Package the anatomy** — the `register(container)` entry point, naming conventions, and the consumer wiring.
2. **Package the configuration** — the `.customize()` options pattern backed by `DI.createInterface` tokens and `AppTask` lifecycle hooks.
3. **Package the resources** — global element/value-converter/binding-behavior registration plus the rendering-pipeline escape hatches (`IRenderer`, `IRendering`, `registerHostNode`).
4. **Package for distribution** — `package.json` with `peerDependencies`, dual ESM/CJS builds, explicit `?raw` template imports, and the `types/assets.d.ts` shim.
5. **Package from existing code** — extract a component library, a feature slice, or a shared directory into a publishable plugin.

The plugin is a distribution boundary. An in-app `Shared.register(container)` is plugin-shaped; shipping it to npm turns the convention contract into a package contract — peer deps, explicit imports, prefixed resources, SemVer.

## Pick a reference

Match the request to exactly one branch. Every branch lives in `reference/` and links back here.

| Request shape | Reference |
|---|---|
| "what is a plugin", "register(container)", "minimal plugin", "how does Aurelia.register work" | [reference/plugin-anatomy.md](reference/plugin-anatomy.md) |
| ".customize() options", "DI.createInterface token", "plugin configuration", "AppTask lifecycle hook" | [reference/configuration.md](reference/configuration.md) |
| "register global resources", "value converter plugin", "IRenderer", "registerHostNode", "binding behavior" | [reference/resources.md](reference/resources.md) |
| "package.json for a plugin", "peerDependencies aurelia", "dual ESM CJS build", "?raw template import", "ship to npm" | [reference/distribution.md](reference/distribution.md) |
| "turn my component library into a plugin", "extract a feature slice", "publish my shared directory" | [reference/extract.md](reference/extract.md) |

If the request spans anatomy and distribution, start with [plugin-anatomy.md](reference/plugin-anatomy.md) and follow its outbound link to [distribution.md](reference/distribution.md).

## Hard guardrails (apply to every branch)

These are restated here for convenience. The canonical always-do list lives in `aurelia-foundation/SKILL.md`; the canonical v1-removal table lives in `aurelia-migration/reference/v1-removals.md`. **This pillar does not duplicate them** — when a guardrail and a project rule disagree, the project rule wins.

- **`.trigger` for custom events.** `.delegate` on a custom event throws `AUR0009`. `.delegate` is for native DOM events only.
- **Kebab-case element names.** Every custom element name must contain a hyphen.
- **`import type` / `export type` for interfaces.** Type-only symbols travel through `import type`; runtime values use regular `import`.
- **`.style` property binding for dynamic CSS.** Never inline `style="width: ${value}%"`.
- **Singleton DI services over Event Aggregator.** Typed constructor-injected services for cross-component state.
- **Models, not DTOs, cross the service boundary.**

## V1 contamination

The seven v1 APIs below are pinned prohibitions in every pillar. **Never package v1 code in place** — lift it first. The canonical table with v2 replacements lives in `aurelia-migration/reference/v1-removals.md`; this pillar defers to it.

- `.delegate` on custom events → **AUR0009** → `.trigger`
- `@inject(...)` decorator → `resolve()` functional API
- `PLATFORM.moduleName('...')` → native bundler import
- `configureRouter(...)` callback → `@route` decorator
- `<router-view>` → `<au-viewport>`
- `<compose view-model="...">` → `<au-compose component="...">`
- `activate(params)` / `deactivate()` → `canLoad` / `loading` / `canUnload` / `unloading`

The extraction reference ([extract.md](reference/extract.md)) opens with a gate that scans for every pattern above; if any is found, it routes to `aurelia-migration` before any structural move.

## What this pillar owns (single source of truth)

These prohibitions are NEW and live **only here**. They are not restated in the foundation pillar or the migration table.

1. **Never bundle `aurelia` as a runtime dependency.** The framework is a `peerDependency`. Bundling it duplicates the framework in the consumer's app — two copies of the DI container, two template compilers, silent breakage.
2. **Never rely on bundler template conventions in a shipped package.** Convention-based `name.ts` + `name.html` pairing is app-only. A published plugin must use explicit `import template from './x.html?raw'` + a `template:` field on `@customElement`, and must ship a `types/assets.d.ts` declaring the `*.html`/`*.css`/`*.module.css` modules. Convention-based pairing is app-only.
3. **Prefix every globally-registered resource with the plugin name.** Unprefixed resources (`button`, `card`) silently collide across plugins. Use `<my-plugin-button>`, not `<button>`.
4. **Always expose `.customize()` for any plugin that takes options.** No globals, no statics, no environment variables. The `.customize(callback)` factory returns a new `Configuration` object whose `register(container)` resolves the user's overrides against defaults.
5. **Export both the aggregate `Plugin`/`Configuration` object AND individual classes.** Consumers who want `Aurelia.register(MyPlugin)` get the aggregate; consumers who want tree-shaking import `AuButton` individually.
6. **Ship dual ESM + CJS + `.d.ts` via the `exports` condition map.** Set `files: ["dist"]` so only build output ships.
7. **Follow SemVer strictly.** Plugins hook framework internals (rendering pipeline, DI, resource registration); a "minor" break in a plugin cascades into every consumer's app.
8. **`@aurelia/compat-v1` is not a destination.** If the source has a v1 surface, lift it first via `aurelia-migration`. Never publish a plugin that depends on the compat shim as its end state.

## Lead with `package`

Use the verb *package* to anchor each action: *package the anatomy*, *package the configuration*, *package the resources*, *package for distribution*, *package from existing code*. The shared vocabulary keeps the agent's mental model on the distribution boundary — a versioned npm unit — not on in-app conventions.

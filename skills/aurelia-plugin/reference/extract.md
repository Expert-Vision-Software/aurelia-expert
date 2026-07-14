# Extract — turn existing code into a publishable plugin

Lift already-written Aurelia code out of its app and package it as a standalone npm plugin. Three source shapes map to the same destination: a component library entry, a large-SPA feature slice, or a shared directory of global resources. The procedure opens with a hard gate: v1 source goes to `aurelia-migration` first, always.

## Gate — is the source v1 or v2?

Scan the candidate files for v1-only patterns (the "lift table" from `aurelia-migration/reference/v1-removals.md`):

- `PLATFORM.moduleName(...)` — *removed in v2.*
- `configureRouter(config, router)` — replaced by `@route`.
- `<router-view>` — replaced by `<au-viewport>`.
- `<compose>` — replaced by `<au-compose>`.
- `@inject(...)` decorator on constructors — replaced by `resolve()` defaults.
- `.delegate` on a custom event (e.g. `save.delegate="..."` where `save` is custom) — throws AUR0009.
- `activate()` / `deactivate()` lifecycle methods — renamed to `canLoad` / `loading` / `canUnload` / `unloading`.

If any of these appear, **stop this procedure**. Branch through `aurelia-migration` first (lead the prompt with `lift`), run the v1-removals table against every candidate file, and only return here when the source is v2-current. **Never package v1 code in place.**

The gate runs once, up front, across all three extraction mappings below. Do not skip it for "simple" extractions — a single v1 file in a plugin taints the package.

## Extraction mapping 1 — Component library entry → plugin

Source shape: an in-app component library at `shared/components/ui/` with a `Shared.register(container)` entry (the canonical structure from `aurelia-component-library`). Extracting it into a plugin makes the kit available to other apps.

| Aspect | Change | Stay | Prohibit |
| :--- | :--- | :--- | :--- |
| Templates | Convention pairing → explicit `import template from './x.html?raw'` + `template:` field | Component anatomy (`@bindable`, `<au-slot>`, computed `classNames`, `.style` binding) | Convention pairing in a shipped package |
| Styles | App-imported tokens.css → consumer-imported stylesheet OR per-component scoped CSS | Token-driven values (`var(--au-*)`) | Raw hex/rem/px literals |
| Configuration | None → add `.customize()` for options (prefix, theme tokens) | Export both aggregate + individual classes | Globals/statics for options |
| Resource names | `ui-button` → `<prefix>-button` (e.g. `mp-button`) | `ui-` prefix if the plugin IS the ui-kit | Unprefixed resources |
| Dependencies | App-level `aurelia` → `peerDependencies.aurelia` | `export type` for unions | Bundling `aurelia` as runtime dep |
| Build | App dev-server → dual ESM + CJS + `.d.ts` | `verbatimModuleSyntax: true` | Single-module-only output |

Key change: the app's `Shared.register(container)` becomes the plugin's `Plugin.register(container)`, augmented with `.customize()`. The `ui-` prefix stays if the plugin IS the ui-kit; otherwise rename to the plugin prefix. See [plugin-anatomy.md](plugin-anatomy.md) for the entry-point shape and [distribution.md](distribution.md) for the build config.

## Extraction mapping 2 — Large-SPA feature slice → plugin

Source shape: a feature slice from a large Aurelia SPA (the feature-first structure from `aurelia-largespa`). The slice has its own `index.ts` with a local child-container registration. Extracting it into a plugin makes the feature available to downstream apps.

**Extractability test:** *if I removed all features from this app, would this component still make sense to a downstream app?*

- **Yes** (generic data-table, auth widget, settings panel with no business types) → extractable.
- **No** (OrderList that imports `Order`, CustomerProfile that imports `Customer`) → stays a feature. Business-vocabulary slices are not plugins.

| Aspect | Change | Stay | Prohibit |
| :--- | :--- | :--- | :--- |
| Entry | Feature's local child-container `index.ts` → plugin root `register(container)` | DI registrations, service interfaces | Leaking feature-internal child containers |
| Templates | Convention pairing → explicit `?raw` + `template:` field | Component structure, `@bindable` surface | Convention pairing in a shipped package |
| Business deps | `import { Order }` → remove; accept data via `@bindable` (generic) | Service interfaces (`IApiClient`) | Hardcoded `Order`/`Customer` types |
| Configuration | None → `.customize()` for options | Singleton services | Feature-scoped DI assumptions |
| Resource names | Bare names → plugin-prefixed | Kebab-case element names | Collisions with consumer app's resources |
| Dependencies | App-level `aurelia` → `peerDependencies` | `import type` discipline | Bundling framework |

Key change: the feature's `index.ts` — which registers resources into a child container scoped to the feature — becomes the plugin's root `register`, registering into the consumer's root container. Any feature-internal assumption that a sibling feature is present must be broken: the plugin must stand alone. See `aurelia-largespa` (slice) for the feature-module pattern this maps from.

## Extraction mapping 3 — Shared directory → plugin (MOST DIRECT)

Source shape: a `shared/` directory of global resources with a `shared/index.ts#register(container)` entry. This is already plugin-shaped — the `register` function is the duck-typed plugin contract. Extracting it into a plugin is mostly a packaging exercise.

| Aspect | Change | Stay | Prohibit |
| :--- | :--- | :--- | :--- |
| Entry | `shared/index.ts#register` → package root `Plugin.register` | The `register(container)` signature | Changing the contract |
| Templates | Convention pairing → explicit `?raw` + `template:` field | Component anatomy | Convention pairing in a shipped package |
| Dependencies | App-level `aurelia` → `peerDependencies.aurelia` | Service singleton registrations | Bundling framework |
| Resource names | Bare or `ui-` names → plugin-prefixed | Kebab-case, PascalCase classes | Unprefixed global resources |
| Configuration | None → optional `.customize()` for options | Existing DI tokens | Removing tokens consumers may resolve |
| Build | App dev-server → dual ESM + CJS + `.d.ts` | `import type` discipline | Single-module-only output |

Key change: `shared/index.ts#register` IS the plugin's `register`. The extraction adds `.customize()` (optional), switches to `?raw` imports, prefixes resources, and adds `peerDependencies` + the dual build. Because the source is already plugin-shaped, this mapping is the lowest-risk of the three.

## Post-extraction checklist (all three mappings)

After the structural move, verify the package contract before publishing:

1. **`?raw` imports everywhere** — `grep -r '@customElement(' src/` and confirm every decorator has a `template:` field. No convention pairing.
2. **`types/assets.d.ts`** — declares `*.html`, `*.css`, `*.module.css`.
3. **`peerDependencies.aurelia`** — not `dependencies`.
4. **`exports` condition map** — ESM + CJS + types.
5. **`files: ["dist"]`** — only build output ships.
6. **Resource prefix** — every global element/converter/behaviour has the plugin prefix.
7. **`.customize()`** — every configurable surface has a callback-based factory.
8. **Dual export** — index exports the aggregate `Plugin` AND individual classes.
9. **Clean build** — `tsc --noEmit` passes with `verbatimModuleSyntax: true`.

## Where to go next

- **Minimal plugin + naming** → [plugin-anatomy.md](plugin-anatomy.md).
- **`package.json`, dual builds, `?raw` imports** → [distribution.md](distribution.md).
- **`.customize()`, AppTask, DI tokens** → [configuration.md](configuration.md).
- **Component library anatomy (tokens, `ui-` layout, anatomy)** → `aurelia-component-library` (assemble).
- **Feature-first layout, `shared/` admission rule** → `aurelia-largespa` (slice).
- **v1 → v2 lift (the gate runs first)** → `aurelia-migration` (lift).

## Review checklist

- The gate ran across every candidate file; zero v1 patterns survive in the extracted source.
- Every template uses `?raw` + `template:` field — no convention pairing.
- Every global resource has the plugin-name prefix.
- Business-vocabulary slices were classified as "stay a feature," not extracted.
- `aurelia` is a `peerDependency`, not a runtime `dependency`.
- `types/assets.d.ts`, `exports` condition map, and `files: ["dist"]` are present.
- The index exports the aggregate `Plugin` AND individual classes for tree-shaking.

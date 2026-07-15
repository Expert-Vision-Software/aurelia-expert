# Changelog

All notable changes to `aurelia-expert` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-07-14

### Added
- New bundled skill `aurelia-ecosystem` — leading word **wire**, seventh pillar (eighth skill overall). Owns the first-party plugin and runtime-ecosystem surface ported and adapted from the vendor `aurelia/skills` package: `@aurelia/fetch-client` (HTTP), `@aurelia/validation`, `@aurelia/dialog`, `@aurelia/state`, `@aurelia/i18n`, forms (`model.bind`/`matcher.bind`/`submit.trigger:prevent`), Vitest + `@aurelia/testing` component testing, and SSR/prerendering (`aurelia2-ssr`, remount takeover, hydration, sitemap/robots). Each ported reference carries an upstream-lineage comment and adapts to this package's guardrails (`resolve()` DI, `dispose`-hook cleanup for `IEventAggregator`, narrow `.style` rule, prohibitions deferred to `aurelia-migration/reference/v1-removals.md`).
- New `aurelia-foundation/reference/cli.md` — the deeper `npx makes aurelia` feature-flag reference (scaffold pillar), linked from the foundation reference table.
- Router (`aurelia-expert`) gains a seventh branch ladder position: `wire → aurelia-ecosystem` after `package`. Description, branch table, pillar-location tree, and handoff block updated.

### Changed
- `src/installer.ts` `SKILL_NAMES` and `tests/skills.test.ts` `SKILL_NAMES` + `REFERENCE_FILES` now include `aurelia-ecosystem` (and `cli.md` under `aurelia-foundation`); the installer copies the new skill on every install/uninstall cycle and the test suite asserts every reference file is non-empty.
- Removed the misguided `.opencode/opencode.json pre-allows` self-config test from `tests/skills.test.ts`. The repo's `.opencode/opencode.json` is a dev-only config (not shipped via `package.json#files`; does not reference the package's own skills). Consumer `permission.skill` allow-listing for every bundled skill is written by `Installer.ensureSkillPermissions` at install time and is already verified by `tests/installer.test.ts` ("writes permission.skill.allow for every bundled skill").

### Fixed
- Dangling `aurelia-testing` deferrals in `aurelia-largespa/SKILL.md` and `aurelia-migration/SKILL.md` now point to `aurelia-ecosystem` (testing reference). The two pillars previously deferred to a non-existent `aurelia-testing` skill.

## [0.2.0] - 2026-07-14

### Added
- New bundled skill `aurelia-component-library` — leading word **assemble**, sixth pillar. Owns the styled, variable-driven component-library workflow on Aurelia v2 + Tailwind: design-token layer (CSS custom properties on the root element with the Tailwind `@theme` bridge), `shared/components/ui/` library layout with the `ui-` element prefix, component anatomy (`@bindable` variants/sizes, `<au-slot>` projection in Light DOM, `.style` property binding), a greenfield deploy procedure, and a migrate-existing procedure with a v1-source gate that defers to `aurelia-migration` (lift) before any structural move.
- Router (`aurelia-expert`) gains a fifth branch ladder position: `assemble → aurelia-component-library` between `resolve` and `slice`. The skill table, branch table, pillar-location tree, and precedence note all updated; precedence clarifies that mixed library + v1 prompts go to `lift` first (the more constrained case wins), then `assemble` for the lifted v2 code.
- New bundled skill `aurelia-plugin` — leading word **package**, seventh pillar. Owns the distributable-plugin workflow on Aurelia v2: the `register(container)` duck-typed entry point, the `.customize()` options pattern with `DI.createInterface` tokens, global resource registration with plugin-name prefixes, AppTask lifecycle hooks, rendering-pipeline extensions (`IRenderer`/`@renderer`, `IRendering`, `registerHostNode`), npm distribution (`peerDependencies` on `aurelia`, dual ESM/CJS + `.d.ts`, explicit `?raw` template imports, `types/assets.d.ts`), and an extract procedure (component-library / feature-slice / shared-dir → plugin) with a v1-source gate that defers to `aurelia-migration` (lift) before any packaging move.
- Router (`aurelia-expert`) gains a sixth branch ladder position: `package → aurelia-plugin` after `lift`. Branch table, pillar-location tree, and precedence notes updated; three new precedence sub-rules disambiguate plugin vs component-library, largespa, and migration (v1 source → lift first).
- `aurelia-expert` router gains a ground-truth note: for SDK and API questions, prefer GitHub (`aurelia/aurelia` `master` branch) as canonical source for the latest. DeepWiki (`deepwiki_ask_question` against `aurelia/aurelia`) is the preferred validator; docs.aurelia.io is fallback for overview content only.
- `AGENTS.md` gains a `<skill_content_rules>` section with five codified lessons from a systematic DeepWiki validation sweep of all seven skills: source hierarchy (GitHub > DeepWiki > docs.aurelia.io > NotebookLM), error-code confirmation requirement, `@inject` severity levels (REMOVED / DEPRECATED / ERROR CODE), `.style` binding narrow rule (not blanket prohibition), and `dispose` as the mandatory `IEventAggregator` cleanup hook.

### Changed
- `src/installer.ts` `SKILL_NAMES` array and `tests/skills.test.ts` `SKILL_NAMES` + `REFERENCE_FILES` now include `aurelia-component-library` and `aurelia-plugin`; the installer copies them on every install/uninstall cycle and the test suite asserts every reference file is non-empty.
- `.opencode/opencode.json` permission allow-list extended to seven skills.

### Fixed
- **AUR0009 → AUR0713 (compile-time):** `.delegate` on custom events throws AUR0713 (template compilation error), not AUR0009. All 25 occurrences corrected across `reference/v1-removals.md`, `reference/debugging.md`, `skills/aurelia-runtime/SKILL.md`, `skills/aurelia-foundation/SKILL.md`, `skills/aurelia-plugin/SKILL.md`, `skills/aurelia-migration/SKILL.md`, and all affected reference files. This was a v1-era error code that did not exist in the v2 template compiler.
- **`@inject` reclassified as DEPRECATED:** `@inject` is still valid in Aurelia v2 — it is not REMOVED. All skill bodies that stated "never use `@inject`" or "does not appear anywhere in v2" corrected to "prefer `resolve()` (still valid but idiomatic v2)". The v1-removals table now says DEPRECATED — prefer `resolve()`; the canonical severity levels in `reference/v1-removals.md` are the source of truth and must not be contradicted in skill bodies.
- **`.style` binding — narrow rule, not blanket prohibition:** Inline `style="width: ${value}%"` is safe when the value is guaranteed non-falsy; the prod-optimizer bug only triggers for `0`/`false`/`''`. Four skill files that said "never inline style=" corrected to the precise conditional: prefer `.style` binding when the interpolated value can be falsy.
- **`IEventAggregator` disposal — `dispose`, not `unbinding`:** `dispose` is the mandatory permanent cleanup hook for `IEventAggregator` subscriptions; `unbinding` runs before potential reactivation and is insufficient. Foundation pillar guardrail corrected; all skill bodies updated accordingly.
- All skill-count references corrected: README.md (SEO title, H1, intro paragraph, v1-contamination bullet), package.json description, `aurelia-plugin/SKILL.md` V1 contamination section, and `au-northwind-pointer.md` now accurately state 7 skills / 6 pillars / 6 prohibited + 1 deprecated v1 pattern.
- Description fields on `aurelia-foundation`, `aurelia-runtime`, and `aurelia-migration` SKILL.md frontmatter use em-dash (`—`) instead of colon-space (`: `) to avoid the YAML nested-mapping parse error in the skills CLI.

## [0.1.0] - 2026-07-13

### Added
- Initial release of the `aurelia-expert` OpenCode plugin + npm skill bundle.
- Five router-routed Aurelia v2 MVVM skills:
  - `aurelia-expert` — leading word **branch**, dispatches to the right pillar.
  - `aurelia-foundation` — leading word **scaffold**, philosophy, quickstart, components, lifecycle, AI tooling.
  - `aurelia-runtime` — leading word **resolve**, DI, routing, events/tasks, cross-feature orchestration.
  - `aurelia-largespa` — leading word **slice** (focal point), feature-first layout, hierarchical `Agents.md`, orchestrator pattern, Model/DTO boundary.
  - `aurelia-migration` — leading word **lift**, v1→v2 removals, debugging, performance, DeepWiki citation protocol.
- `plugin.ts` OpenCode plugin factory with version-marker gated `config()` hook that auto-installs on first load.
- `src/installer.ts` `Installer` class with `install()`, `uninstall()`, `status()`, idempotent version-marker copy, permission pre-grant, plugin entry add/remove, and `migrateRootConfig()` for legacy `opencode.json` → `.opencode/opencode.json` migration.
- `src/plugin-name.ts` `PluginNameNormalizer` class with case-insensitive `@<version>` stripping (scoped-package safe).
- `src/scope-resolver.ts` `ScopeResolver` class that resolves local vs global scope from the plugin's working directory (cross-platform path separator).
- `src/cli.ts` Bun-runnable CLI with `install`, `uninstall`, `status` subcommands (no interactive prompts; CI-friendly).
- `.opencode/opencode.json` self-config registering `../skills` and pre-allowing all 5 skills.
- `.github/workflows/release.yml` two-job pipeline: GitHub Release (notes extracted from `CHANGELOG.md`) + `npm publish --provenance --access public`.
- Test suites: `tests/skills.test.ts` (frontmatter + reference-file assertions, plugin-name normalization round-trip), `tests/installer.test.ts` (mocked temp project + global dirs, install/uninstall/status round-trips, idempotency, legacy migration).
- MIT license, `AGENTS.md` maintainer contract, `CONTRIBUTING.md` developer guide, `README.md` with three-channel install story.
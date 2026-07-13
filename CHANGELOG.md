# Changelog

All notable changes to `aurelia-expert` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
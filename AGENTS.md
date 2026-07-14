# AGENTS.md - aurelia-expert

<critical_rules priority="highest">
1. The six bundled skills describe **Aurelia v2 only**. The seven v1 APIs — `.delegate` (on custom events), `<router-view>`, `PLATFORM.moduleName`, `configureRouter`, `<compose>`, `@inject`, `activate/deactivate` — are pinned as prohibitions in every pillar. Never soften a prohibition in `skills/*/SKILL.md` or `reference/*.md`.
2. `au-northwind` is **STRUCTURAL ONLY**. Reference it for folder layout, slice boundaries, and hierarchical `Agents.md` patterns — never as an Aurelia v2 API source. The `aurelia-largespa/reference/au-northwind-pointer.md` is the single source of truth for this guardrail; do not duplicate it elsewhere.
3. The router (`aurelia-expert`) is the **single entry point**. It hands off to a pillar and stops. The five pillars are peer-skills, not nested; never re-route from one pillar to another. If two branches both fit, defer to the more specific one (`aurelia-migration` > `aurelia-largespa` for migration-of-large-SPA prompts; `aurelia-migration` > `aurelia-component-library` for migration-with-library prompts; see `aurelia-expert/SKILL.md` Precedence section).
4. The active project's local Aurelia instructions file (`AGENTS.md`, `CLAUDE.md`, or repo conventions) **overrides** anything in this package. The pillars' guardrails (`.trigger`, kebab-case, `import type`, `.style` property binding, singleton DI over EventAggregator, Models not DTOs) are defaults; project rules win.
5. The `description` field on every skill's frontmatter must remain ≤1024 characters, in third person, and front-load the leading word (`branch`, `scaffold`, `resolve`, `slice`, `lift`). Tests in `tests/skills.test.ts` enforce this — do not weaken the assertions.
</critical_rules>

<context_hierarchy>
<system>OpenCode plugin loader + npm distribution</system>
<domain>Aurelia v2 MVVM SPA expertise, packaged for AI coding agents</domain>
<task>Bundle six router-routed markdown skills into a publishable OpenCode plugin + npm package</task>
<execution>npm install `aurelia-expert` → OpenCode loads `plugin.ts#config()` → idempotent install of six skills into `.opencode/skills/`</execution>
</context_hierarchy>

<role>
<identity>aurelia-expert package maintainer</identity>
<scope>This repository only</scope>
<constraints>
- Markdown-only skill bundle; no runtime dependencies beyond `@opencode-ai/plugin` (peer to OpenCode itself).
- CLI requires Bun ≥ 1.0; tests require `bun test`.
- Single source of truth for each rule: a prohibition lives in exactly one file (the migration pillar's v1-removals table is the canonical "what not to do" reference; the foundation pillar's hard-guardrails list is the canonical "always do" reference).
</constraints>
</role>

<bundled_skills>
<skill name="aurelia-expert" path="skills/aurelia-expert/SKILL.md" leading-word="branch" role="router" requires="none" />
<skill name="aurelia-foundation" path="skills/aurelia-foundation/SKILL.md" leading-word="scaffold" role="pillar" requires="aurelia-expert (router)" references="philosophy, quickstart, components, lifecycle, ai-tooling" />
<skill name="aurelia-runtime" path="skills/aurelia-runtime/SKILL.md" leading-word="resolve" role="pillar" requires="aurelia-expert (router)" references="di, routing, events-tasks, orchestration" />
<skill name="aurelia-largespa" path="skills/aurelia-largespa/SKILL.md" leading-word="slice" role="pillar-focal" requires="aurelia-expert (router)" references="feature-first, directory-layout, feature-module, hierarchical-agents-md, orchestrator, model-dto, au-northwind-pointer" focal-point="true" />
<skill name="aurelia-migration" path="skills/aurelia-migration/SKILL.md" leading-word="lift" role="pillar" requires="aurelia-expert (router)" references="v1-removals, debugging, performance, deepwiki-protocol" />
<skill name="aurelia-component-library" path="skills/aurelia-component-library/SKILL.md" leading-word="assemble" role="pillar" requires="aurelia-expert (router)" references="tokens, library-layout, component-anatomy, greenfield, migrate" />
</bundled_skills>

<self_config>
<location>.opencode/opencode.json</location>
<purpose>Register `../skills` as a skill path and pre-allow all six skills for the package's own dev workflow</purpose>
<pointer_in_package_json>index.ts → plugin.ts (verbatim one-line re-export)</pointer_in_package_json>
<opencode_plugin_entry>"aurelia-expert"</opencode_plugin_entry>
</self_config>

<consumer_install>
<channel name="bunx">
<command>bunx aurelia-expert install [--scope local|global]</command>
<use_case>Default install path for OpenCode users; CI-friendly (no interactive prompts)</use_case>
</channel>
<channel name="skills.sh">
<command>npx skills add expert-vision-software/aurelia-expert --skill aurelia-expert -a opencode</command>
<use_case>Cross-agent install (Claude Code, OpenCode, other skill-compatible agents)</use_case>
</channel>
<channel name="opencode.json">
<snippet>{"plugin": ["aurelia-expert"]}</snippet>
<use_case>OpenCode auto-install on next session start; `plugin.ts#config()` runs idempotent install with version marker</use_case>
</channel>
<file_fallback>
<snippet>{"plugin": ["file:///absolute/path/to/aurelia-expert"]}</snippet>
<use_case>Local development against a checkout of this repo</use_case>
</file_fallback>
<prerequisites>
- bun ≥ 1.0 OR node ≥ 18 (npm registry fetch works from either)
- No runtime dependencies on Aurelia itself — skills are pure documentation
</prerequisites>
</consumer_install>

<testing>
<runner>bun test</runner>
<files>
- tests/skills.test.ts — frontmatter validation, YAML-parse regression (colon-space guard), area/leading-word metadata assertions, reference-file non-emptiness, self-config structure, plugin-name normalization round-trip
- tests/installer.test.ts — mocked temp project + global dirs; install/uninstall/status round-trips; idempotent re-install (case-insensitive, `@<version>` stripped); legacy `opencode.json` → `.opencode/opencode.json` migration
</files>
<runner>bun run check</runner>
<files>tsconfig.json with `verbatimModuleSyntax: true`</files>
<coverage>TypeScript surface of `src/`, `plugin.ts`, `index.ts`; tsc runs with `noEmit: true`</coverage>
</testing>

<publishing>
<command>npm publish --provenance --access public</command>
<trigger>`.github/workflows/release.yml` on `v*` tag push</trigger>
<prerequisite>`NPM_TOKEN` secret and `id-token: write` permission for provenance attestation</prerequisite>
<release_notes>Extracted from CHANGELOG.md section matching `## [<version>]`</release_notes>
<local_dry_run>npm pack --dry-run (verifies `files` whitelist ships only index.ts, plugin.ts, src, skills, README.md, AGENTS.md, CHANGELOG.md, LICENSE)</local_dry_run>
</publishing>

<coding_rules>
1. No comments in TypeScript. Use descriptive method/variable names instead.
2. Classes over free helper functions. Each new class lives in its own file.
3. Nullable over optional in interfaces — `value: string | null`, never `value?: string`.
4. Function declarations, not `const name = () => {}`. Place declarations BELOW first usage.
5. The `leading-word` field on each skill's frontmatter is the agent's primary dispatch key. Do not rename it without updating `aurelia-expert`'s router.
6. Skill content is the source of truth. Do not add runnable code under `src/` that is not part of the install/uninstall/status surface.
7. Dev-only skills in `.agents/skills/` (notebooklm, writing-great-skills) carry `metadata.internal: true` so `npx skills` skips them during discovery and listing. **`npx skills update` overwrites SKILL.md from the upstream source and drops this flag** — re-apply `metadata.internal: true` after every update.
8. Unquoted YAML description values must never contain `: ` (colon-space) — it triggers a nested-mapping parse error in the skills CLI, silently dropping the skill. Use ` — ` (em-dash space) instead. The YAML-parse regression test in `tests/skills.test.ts` enforces this.
</coding_rules>
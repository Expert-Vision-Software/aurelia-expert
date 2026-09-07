# AGENTS.md - aurelia-expert

<critical_rules priority="highest">
1. The eight bundled skills describe **Aurelia v2 only**. Six of the seven v1 patterns are prohibited (REMOVED or compile-time error): `.delegate` (any event — removed from the v2 binding command set; throws AUR0713 at compile time), `<router-view>`, `PLATFORM.moduleName`, `configureRouter`, `<compose>`, `activate/deactivate`. `@inject` is **DEPRECATED** (still valid, `resolve()` is preferred) — it must not be stated as REMOVED. Severity levels in `reference/v1-removals.md` are the authoritative classification; never contradict them in skill bodies.
2. `au-northwind` is **STRUCTURAL ONLY**. Reference it for folder layout, slice boundaries, and hierarchical `Agents.md` patterns — never as an Aurelia v2 API source. The `aurelia-largespa/reference/au-northwind-pointer.md` is the single source of truth for this guardrail; do not duplicate it elsewhere.
3. The router (`aurelia-expert`) is the **single entry point**. It hands off to a pillar and stops. The seven pillars are peer-skills, not nested; never re-route from one pillar to another. If two branches both fit, defer to the more specific one (`aurelia-migration` > `aurelia-largespa` for migration-of-large-SPA prompts; `aurelia-migration` > `aurelia-component-library` for migration-with-library prompts; `aurelia-migration` > `aurelia-plugin` for packaging-v1-source prompts; see `aurelia-expert/SKILL.md` Precedence section).
4. The active project's local Aurelia instructions file (`AGENTS.md`, `CLAUDE.md`, or repo conventions) **overrides** anything in this package. The pillars' guardrails (`.trigger`, kebab-case, `import type`, `.style` property binding, singleton DI over EventAggregator, Models not DTOs) are defaults; project rules win.
5. The `description` field on every skill's frontmatter must remain ≤1024 characters, in third person, and front-load the leading word (`branch`, `scaffold`, `resolve`, `assemble`, `slice`, `lift`, `package`, `wire`). Tests in `tests/skills.test.ts` enforce this — do not weaken the assertions.
</critical_rules>

<context_hierarchy>
<system>OpenCode plugin loader + npm distribution</system>
<domain>Aurelia v2 MVVM SPA expertise, packaged for AI coding agents</domain>
<task>Bundle eight router-routed markdown skills into a publishable OpenCode plugin + npm package</task>
<execution>npm install `aurelia-expert` → OpenCode loads `plugin.ts#config()` → idempotent install of eight skills into `.opencode/skills/`</execution>
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
<skill name="aurelia-plugin" path="skills/aurelia-plugin/SKILL.md" leading-word="package" role="pillar" requires="aurelia-expert (router)" references="plugin-anatomy, configuration, resources, distribution, extract" />
<skill name="aurelia-ecosystem" path="skills/aurelia-ecosystem/SKILL.md" leading-word="wire" role="pillar" requires="aurelia-expert (router)" references="ssr, fetch-client, validation, dialog, state, i18n, forms, testing" />
</bundled_skills>

<self_config>
<location>.opencode/opencode.json</location>
<purpose>Dev-only config for this repo (registers `../.agents/skills`); NOT shipped (`package.json#files` excludes `.opencode`) and does NOT reference the package's own skills. Consumer permission-allowlisting is the installer's job: `Installer.ensureSkillPermissions` writes `permission.skill[name]="allow"` for every bundled skill into the consumer's opencode.json at install time.</purpose>
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

<skill_content_rules>
The following教训 emerged from a systematic DeepWiki validation sweep of all eight skills. Violations
of any rule below have shipped into released skill content and required patches.

## Source hierarchy

| Source | Role | When to use |
|--------|------|-------------|
| `aurelia/aurelia` GitHub (`packages/<pkg>/docs/*.md`) | **Primary ground truth** — direct source, not docs site | Confirming any API claim: error codes, binding commands, decorator presence, lifecycle hooks, DI semantics |
| DeepWiki (`deepwiki_ask_question` against `aurelia/aurelia`) | **Primary validator** — AI-grounded in current source; returns file paths | Validating prescriptive rules before they ship; catching stale docs |
| `docs.aurelia.io` | Overview and tutorial content only | Initial orientation, not API detail |
| NotebookLM | **Hypothesis generator** — useful for exploring patterns, connections, and unknowns | Generate hypotheses; **always confirm against DeepWiki or direct source** before writing into skill content |
| `reference/v1-removals.md` | Canonical "what not to do" table | Single source of truth for prohibition claims |

## Never cite an error code without source confirmation

Error codes are implementation details that change between releases. AUR0009 vs AUR0713 is a real example: the v1-removals table carried AUR0009 (from a v1-era mental model), but the v2 template compiler emits AUR0713 for unknown binding commands. Validate error codes against `aurelia/aurelia` directly. The same applies to any "throws at runtime" vs "throws at compile time" distinction — this changes error classification.

## `@inject` is not removed — "never" is almost always wrong

A recurring mistake is stating that a v2 API is "gone" or "never use" when it is actually deprecated-but-functional.
`@inject` is still valid in v2; `resolve()` is preferred but `@inject` is not a runtime error. Before writing
a prohibition, confirm with DeepWiki. The correct severity levels are:

- **REMOVED** — does not exist in v2 at all (e.g. `PLATFORM.moduleName`, `configureRouter`)
- **DEPRECATED** — still works but a v2-native alternative exists and is preferred (e.g. `@inject`, `IEventAggregator` as default bus)
- **ERROR CODE** — removed from the binding command set and throws at compile time (`.delegate` on any event → AUR0713; `.call` also removed → lambda expressions)

The v1-removals table uses REMOVED / DEPRECATED correctly; skill body text must match.

## `.style` binding: the narrow rule, not the blanket prohibition

The inline `style="width: ${value}%"` bug is real (production optimizer drops placeholders for falsy values,
producing `style="width:{};"`). However, it only triggers when the interpolated value is `0`/`false`/`''`.
Writing "never inline `style=`" as a blanket rule is wrong — it is safe for guaranteed non-falsy values.
The correct formulation is: **prefer `.style` binding when the value can be falsy**. See
`aurelia-migration/reference/debugging.md` (prod-build 0-value style bug section) for the full technical
explanation. The foundation, component-library, plugin, and migration pillars all now carry the correct
narrow formulation; new skill content must follow it.

## Disposal hooks: `dispose` is mandatory, not `unbinding`

`IEventAggregator` subscriptions leak if not permanently disposed. The correct mandatory cleanup site is
`dispose` (permanent teardown), not `unbinding` (which runs before potential reactivation). DeepWiki
confirmed this. The foundation pillar's guardrail has been updated accordingly; always cite `dispose` as
the cleanup hook when writing about `IEventAggregator` subscription management.

## Every prohibition lives in exactly one canonical file

The migration pillar's `reference/v1-removals.md` is the single source of truth for v1-prohibition claims.
Skill bodies must not re-state prohibitions with different severity levels or error codes — if the table
says DEPRECATED, the skill body cannot say REMOVED. When updating a prohibition in the table, audit all
skill bodies and reference files for consistent re-statements (the DeepWiki sweep caught 25 inconsistencies
in one pass). Add a re-statement audit to the pre-release checklist.
</skill_content_rules>
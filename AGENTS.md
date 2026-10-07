# AGENTS.md - aurelia-expert

Aurelia v2 MVVM SPA expertise, packaged for AI coding agents: eight router-routed
markdown skills (one router, seven pillars) shipped as an OpenCode plugin + npm
package, installed idempotently at plugin load. Maintainer scope: this repository.

## Guardrails (highest priority)

1. The eight bundled skills describe **Aurelia v2 only**. Each v1 pattern carries its
   severity level (REMOVED / DEPRECATED / ERROR CODE) from the canonical removals
   table; skill bodies match it. `@inject` is DEPRECATED — still valid, `resolve()`
   preferred — and must not read as REMOVED.
2. `au-northwind` is **structural only** — folder layout, slice boundaries,
   hierarchical `Agents.md` patterns. Canonical pointer:
   `aurelia-largespa/reference/au-northwind-pointer.md`.
3. The router is the **single entry point**: it hands off to a pillar and stops.
   Pillars are peers; they never re-route. Overlap resolves by the precedence pairs
   in the router's Precedence section (ADR-0001).
4. The active project's local instructions (`AGENTS.md`, `CLAUDE.md`, repo
   conventions) **override** this package. Pillar guardrails are defaults.
5. Frontmatter contract, enforced by `tests/skills.test.ts`: `description` ≤1024
   chars, third person, leading word front-loaded. Extend the assertions when the
   contract grows.

## Layout & docs

- Domain language: [CONTEXT.md](CONTEXT.md). Decisions: `docs/adr/0001`–`0005`
  (routing shape, markdown-only bundle, canonical-file rule, ground-truth
  validation, installer-owned config).
- Eight skills under `skills/<name>/SKILL.md`; frontmatter is the index
  (leading word, references, focal point).
- Content governance: a prohibition originates only in its canonical file; changing
  one triggers a re-statement audit across pillars and reference files (ADR-0003).
  API claims — error codes, lifecycle semantics — confirm against ground truth
  (`aurelia/aurelia` source, directly or via DeepWiki) before shipping;
  `docs.aurelia.io` orients; NotebookLM hypothesizes (ADR-0004).

## Repo config

- `.opencode/opencode.json` is the **self config**: dev-only, never shipped, never
  references the package's own skills. Consumer permission-allowlisting is installer
  work (`Installer.ensureSkillPermissions`).
- Dev-only skills in `.agents/skills/` carry `metadata.internal: true`.
  **`npx skills update` drops that flag** — re-apply it after every update.

## Distribution

- Consumer install channels and load-time semantics: README.md ("Installation").
- Install is registration-driven and manifest-gated; consumer-modified files are
  skipped unless forced (ADR-0005).

## Coding rules

1. No comments in TypeScript — descriptive names carry the meaning.
2. Classes over free functions; one class per file.
3. Nullable over optional — `value: string | null`.
4. Function declarations below first usage.
5. A leading-word rename lands together with the router.
6. `src/` carries only the install/uninstall/status surface; expertise lives in
   skill content.
7. Unquoted YAML descriptions use ` — ` (em-dash space); `: ` triggers a
   nested-mapping parse error that silently drops the skill (test-enforced).

## Verify

- `bun test` · `bun run check` (tsc, `noEmit`, `verbatimModuleSyntax`).
- Pre-publish: `npm pack --dry-run` shows exactly the `files` whitelist.
- Release: push `v*` → `release.yml` publishes with provenance; notes come from the
  matching `## [<version>]` section in CHANGELOG.md.

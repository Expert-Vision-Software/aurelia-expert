# Contributing to aurelia-expert

Thanks for your interest in contributing! This guide covers the technical internals, development setup, and architecture.

## Development setup

### Prerequisites

- [Bun](https://bun.sh) `>=1.0.0` — required for the CLI installer, test suite, and OpenCode plugin runtime.

### Install dependencies

```bash
bun install
```

### Run the test suite

```bash
bun test
```

Seven suites cover the package:

- `tests/skills.test.ts` — YAML-parsed frontmatter validation per skill (double-quoted scalars, name matches folder, description 1–1024 chars third-person with the leading word front-loaded, `metadata.area` + `metadata.leading-word` present, `focal-point: true` on `aurelia-largespa`, `ground-truth` on `aurelia-expert`), every `reference/<file>.md` non-empty, `.opencode/opencode.json` registers `opencode-architect` by name or by a path resolving to it, `package.json#bin["aurelia-expert"]` points at `src/cli.ts`, plugin-name normalization round-trip.
- `tests/installer.test.ts` — mocked temp project + global dirs: install copies every bundled skill and writes the v2 `permissions` ruleset plus the `plugins` entry; manifest-gated idempotency (zero-write no-op, version-drift upgrade, consumer-modified skip unless `--force`); semantic dedup across name / `@latest` / version / case variants and path-form entries; `opencode.jsonc` detection; splice-writer byte preservation; uninstall cleanup; status reporting.
- `tests/plugin.test.ts` — plugin entry contract: the entry re-exports the `src/plugin.ts` default (same `id`, same effect reference), install-on-load, advisory-once with zero writes when unregistered, skipped-consumer-modified-file warning.
- `tests/config-splice.test.ts` — byte-preserving splice-writer properties on comment-laden configs.
- `tests/advisory.test.ts` — failure-advisory once-guard independence and remediation content, cache-pruner key selectivity, missing-asset CLI-throw / load-warn split.
- `tests/v2-host.test.ts` — v2 host contract: `exports` maps both `.` and `./server` to the entry; the entry default-exports the `Plugin.define` shape.
- `tests/fixture-config-schema.test.ts` — every config the installer emits decodes against `@opencode/schema` `Config.Info`.

### Type-check

```bash
bun run check
```

Runs `tsc --noEmit` against `*.ts`, `src/**/*.ts`, and `tests/**/*.ts` with `verbatimModuleSyntax: true`.

### Smoke-test the CLI

```bash
bunx . install --scope local
bunx . status
bunx . uninstall --scope local
```

## File layout

```
aurelia-expert/
├── .github/
│   └── workflows/
│       └── release.yml       # CI: GitHub Release + npm publish --provenance
├── .opencode/
│   └── opencode.json         # dev-only self-config: v2 plugins registration (never shipped)
├── skills/
│   ├── aurelia-expert/       # router (leading word: branch)
│   │   ├── SKILL.md
│   │   └── REFERENCE.md
│   ├── aurelia-foundation/   # pillar (leading word: scaffold)
│   │   ├── SKILL.md
│   │   └── reference/{philosophy,quickstart,components,lifecycle,ai-tooling}.md
│   ├── aurelia-runtime/      # pillar (leading word: resolve)
│   │   ├── SKILL.md
│   │   └── reference/{di,routing,events-tasks,orchestration}.md
│   ├── aurelia-largespa/     # pillar-focal (leading word: slice)
│   │   ├── SKILL.md
│   │   └── reference/{feature-first,directory-layout,feature-module,hierarchical-agents-md,orchestrator,model-dto,au-northwind-pointer}.md
│   ├── aurelia-migration/    # pillar (leading word: lift)
│   │   ├── SKILL.md
│   │   └── reference/{v1-removals,debugging,performance,deepwiki-protocol}.md
│   ├── aurelia-component-library/  # pillar (leading word: assemble)
│   │   ├── SKILL.md
│   │   └── reference/{tokens,library-layout,component-anatomy,greenfield,migrate}.md
│   ├── aurelia-plugin/      # pillar (leading word: package)
│   │   ├── SKILL.md
│   │   └── reference/{plugin-anatomy,configuration,resources,distribution,extract}.md
│   └── aurelia-ecosystem/   # pillar (leading word: wire)
│       ├── SKILL.md
│       └── reference/{ssr,fetch-client,validation,dialog,state,i18n,forms,testing}.md
├── src/
│   ├── cli.ts                # CLI entry: install / uninstall / status / clear-cache
│   ├── commands/
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   ├── status.ts
│   │   └── clear-cache.ts
│   ├── installer.ts          # Installer class — manifest-gated install/uninstall/status
│   ├── load-installer.ts     # LoadInstaller — install-on-load, zero config writes
│   ├── registration.ts       # RegistrationDetector — scope detection (name + path-form, json + jsonc)
│   ├── manifest.ts           # InstallManifest — per-file sha256 manifest and dispositions
│   ├── plugin.ts             # Plugin.define({ id, effect }) — Effect-first v2 entry
│   ├── plugin-name.ts        # PluginNameNormalizer class
│   ├── plugin-entry.ts       # PluginEntryResolver — path/file:// entry resolution
│   ├── jsonc.ts              # JsoncParser — comment/trailing-comma-tolerant reads
│   ├── config-paths.ts       # ConfigPaths — opencode.json/.jsonc candidates
│   ├── config-text-scanner.ts # ConfigTextScanner — raw-text member/element regions
│   ├── config-splice-writer.ts # ConfigSpliceWriter — byte-preserving config edits
│   ├── config-warnings.ts    # once-per-path warnings and refusals
│   ├── load-failure-advisory.ts # LoadFailureAdvisory — guarded once-only failure advisory
│   └── npm-cache-pruner.ts   # NpmCachePruner — self-only npm cache generations
├── tests/
│   ├── installer.test.ts
│   ├── skills.test.ts
│   ├── plugin.test.ts
│   ├── config-splice.test.ts
│   ├── advisory.test.ts
│   ├── v2-host.test.ts
│   ├── fixture-config-schema.test.ts
│   └── config-schema-validator.ts
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── index.ts                  # module entry: re-exports src/plugin.ts
├── package.json
└── tsconfig.json
```

## Architecture

### Install command

`bunx aurelia-expert install` copies skill files to the target `skills/` directory and registers the package in the consumer config:

- **Local** (default): copies to `{project}/.opencode/skills/{aurelia-expert,aurelia-foundation,aurelia-runtime,aurelia-component-library,aurelia-largespa,aurelia-migration,aurelia-plugin,aurelia-ecosystem}/` and adds `aurelia-expert@latest` to the `plugins` array of `{project}/.opencode/opencode.json`.
- **Global**: copies to `~/.config/opencode/skills/{aurelia-expert,...}/` and updates `~/.config/opencode/opencode.json`.

It grants the eight skills via the ordered `permissions` ruleset (`{ action: "skill", resource: "<skill-id>", effect: "allow" }`) and is manifest-gated: each install records per-file sha256 hashes in `aurelia-expert.manifest.json`, so re-runs are zero-write no-ops unless the package version drifts or a file is missing, and consumer-modified files are skipped unless `--force`. Config edits are byte-preserving text splices — comments, indentation, and key order outside the edited array survive; the installer refuses to write when no splice anchor exists instead of reformatting. Explicit installs prune this package's own npm cache generations; `bunx aurelia-expert clear-cache` does the same on demand.

### Plugin auto-install

When OpenCode loads the package via the `plugins` array, the Effect-first entry (`src/plugin.ts`, `Plugin.define({ id, effect })`) runs the load-time installer (`LoadInstaller`). `RegistrationDetector` detects where the plugin is registered — global config, `.opencode/opencode.json`, or a root `opencode.json`, each read as `opencode.json` or `opencode.jsonc` — matching `name` ≡ `name@latest` ≡ `name@x.y.z` plus `file://`/path entries that resolve to this package, with the legacy singular `plugin` key still detected read-only. Skills are ensured only in the detected scope(s). The load path performs zero config writes: no `plugins` edits, no permission writes, no legacy-record migration, no root-config migration, and it never deletes cache — at load, config ownership is advisory-only (ADR-0007).

### CLI commands

| Command | Description |
| --- | --- |
| `bunx aurelia-expert install` | Install skills locally (or `--scope global`) |
| `bunx aurelia-expert install --scope global` | Install skills globally |
| `bunx aurelia-expert uninstall` | Remove installed skills |
| `bunx aurelia-expert status` | Check install status and version |
| `bunx aurelia-expert clear-cache` | Remove this package's own npm cache generations |
| `bunx aurelia-expert --help` | Show help |
| `bunx aurelia-expert --version` | Show version |

`index.ts` is the module entry, a one-line default re-export of `src/plugin.ts`. `src/cli.ts` is the binary entry exposed via `package.json#bin`.

### Install via file:// reference

For local development against a checkout of this repo, reference the package directory directly from the consumer's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["file:///absolute/path/to/aurelia-expert"]
}
```

This skips the npm install. OpenCode will auto-install skills from the local checkout on first load, and the installer recognizes the path-form entry itself — a later explicit `bunx aurelia-expert install` will not add a duplicate npm-name entry beside it.

## Skill metadata conventions

- Every skill's frontmatter **must** declare `area` and `leading-word` under `metadata`. The router (`aurelia-expert`) reads the leading word off the request and dispatches accordingly.
- `aurelia-largespa` carries `metadata.focal-point: true` — that flag is the agent's hint to reach for the slice pillar first when organizing a large SPA. Tests assert the flag is present.
- The router's `description` front-loads the word **branch**; each pillar's description front-loads its own leading word (`scaffold`, `resolve`, `assemble`, `slice`, `lift`, `package`, `wire`). This is the only reliable way to make model-invoked skills fire on keyword prompts.
- `au-northwind` is STRICTLY structural. The `aurelia-largespa/reference/au-northwind-pointer.md` is the canonical guardrail — never duplicate its content elsewhere.
- Frontmatter scalars are double-quoted (native booleans stay bare). Tests parse the frontmatter as YAML and assert the quoting, so a bare string fails the suite.

## Coding rules

1. **No comments in TypeScript.** Use descriptive method/variable names instead.
2. **Classes over free helper functions.** Each new class lives in its own file under `src/`.
3. **Nullable over optional** in interfaces — `value: string | null`, never `value?: string`.
4. **Function declarations**, not `const name = () => {}`. Place declarations BELOW first usage.
5. **Skill frontmatter is the source of truth.** Do not edit `skills/*/SKILL.md` frontmatter in ways that break the `name` / `description` / `leading-word` contract. Tests assert these invariants.
6. **Only add code under `src/`** that supports the install/uninstall/status surface. This is a skill-bundling package, not a runtime library.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Skill not in `<available_skills>` list | Not installed yet | Run `bunx aurelia-expert install` (or `--scope global`) |
| Skill not in `<available_skills>` list after install | Bun `<1.0.0` or permission deny | Ensure Bun `>=1.0.0`; check the `permissions` ruleset in `.opencode/opencode.json` |
| `bunx aurelia-expert` not found | Bun missing or package not in PATH | Install Bun from `bun.sh`; try `npx aurelia-expert install` as fallback |
| Duplicate `aurelia-expert` entries in `plugins[]` | Manual edit + reinstall | `Installer.addPluginIfMissing()` is idempotent across name and path-form entries; safe to re-run `install` |
| Skills reinstall on every start / version never settles | Corrupt npm cache generation | Run `bunx aurelia-expert clear-cache`, then restart |
| Legacy root `opencode.json` not migrated | Migration is opt-in | Pass `--migrate-root-config` to `install` |
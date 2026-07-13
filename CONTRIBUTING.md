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

Two suites cover the package:

- `tests/skills.test.ts` — frontmatter validation per skill (name matches folder, description 1–1024 chars, MIT license, compatibility comma-list), `metadata.area` + `metadata.leading-word` present, `metadata.focal-point: true` on `aurelia-largespa`, `metadata.ground-truth: https://docs.aurelia.io` on `aurelia-expert`, every `reference/<file>.md` non-empty, `.opencode/opencode.json` registers skill paths + pre-allows all 5 skills, `package.json#bin["aurelia-expert"]` points at `src/cli.ts`, plugin-name normalization round-trip.
- `tests/installer.test.ts` — mocked temp project + global dirs; install copies every bundled skill and writes `.version` markers; permission.skill pre-granted; plugin[] contains `aurelia-expert`; idempotent re-install does not duplicate; legacy root `opencode.json` migrates into `.opencode/opencode.json`; uninstall removes skill dirs + plugin entry; status reports install state.

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
│   └── opencode.json         # self-config: skills.paths + permission.skill
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
│   └── aurelia-migration/    # pillar (leading word: lift)
│       ├── SKILL.md
│       └── reference/{v1-removals,debugging,performance,deepwiki-protocol}.md
├── src/
│   ├── cli.ts                # CLI entry: install / uninstall / status
│   ├── commands/
│   │   ├── install.ts
│   │   ├── uninstall.ts
│   │   └── status.ts
│   ├── installer.ts          # Installer class — install/uninstall/status
│   ├── plugin-name.ts        # PluginNameNormalizer class
│   └── scope-resolver.ts     # ScopeResolver class (cross-platform path)
├── tests/
│   ├── installer.test.ts
│   └── skills.test.ts
├── .gitignore
├── AGENTS.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── index.ts                  # module entry: re-exports plugin.ts
├── package.json
├── plugin.ts                 # plugin entry with config hook (auto-install on load)
└── tsconfig.json
```

## Architecture

### Install command

`bunx aurelia-expert install` copies skill files to the target `skills/` directory and registers the package in `opencode.json`:

- **Local** (default): copies to `{project}/.opencode/skills/{aurelia-expert,aurelia-foundation,aurelia-runtime,aurelia-largespa,aurelia-migration}/` and updates `{project}/.opencode/opencode.json`.
- **Global**: copies to `~/.config/opencode/skills/{aurelia-expert,...}/` and updates `~/.config/opencode/opencode.json`.

It also pre-grants `permission.skill: "allow"` for all five skills and writes a `.version` marker under `skills/aurelia-expert/` to skip re-install on subsequent loads.

### Plugin auto-install

When OpenCode loads the package via `opencode.json` plugins array, `plugin.ts` runs the same (local) install logic with a version-marker check — so the package auto-installs skills on first use if not already installed. The check uses `ScopeResolver.resolve(directory, globalConfigPath)` so the plugin auto-installs at the correct scope when running from `~/.config/opencode/`.

### CLI commands

| Command | Description |
| --- | --- |
| `bunx aurelia-expert install` | Install skills locally (or `--scope global`) |
| `bunx aurelia-expert install --scope global` | Install skills globally |
| `bunx aurelia-expert uninstall` | Remove installed skills |
| `bunx aurelia-expert status` | Check install status and version |
| `bunx aurelia-expert --help` | Show help |
| `bunx aurelia-expert --version` | Show version |

`index.ts` is the module entry, a one-line re-export of `plugin.ts`. `src/cli.ts` is the binary entry exposed via `package.json#bin`.

### Install via file:// reference

For local development against a checkout of this repo, reference the package directory directly from the consumer's `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///absolute/path/to/aurelia-expert"]
}
```

This skips the npm install. OpenCode will auto-install skills from the local checkout on first load.

## Skill metadata conventions

- Every skill's frontmatter **must** declare `area` and `leading-word` under `metadata`. The router (`aurelia-expert`) reads the leading word off the request and dispatches accordingly.
- `aurelia-largespa` carries `metadata.focal-point: true` — that flag is the agent's hint to reach for the slice pillar first when organizing a large SPA. Tests assert the flag is present.
- The router's `description` front-loads the word **branch**; each pillar's description front-loads its own leading word (`scaffold`, `resolve`, `slice`, `lift`). This is the only reliable way to make model-invoked skills fire on keyword prompts.
- `au-northwind` is STRICTLY structural. The `aurelia-largespa/reference/au-northwind-pointer.md` is the canonical guardrail — never duplicate its content elsewhere.

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
| Skill not in `<available_skills>` list after install | Bun `<1.0.0` or permission deny | Ensure Bun `>=1.0.0`; check `.opencode/opencode.json#permission.skill` |
| `bunx aurelia-expert` not found | Bun missing or package not in PATH | Install Bun from `bun.sh`; try `npx aurelia-expert install` as fallback |
| Duplicate `aurelia-expert` entries in `plugin[]` | Manual edit + reinstall | `Installer.addPluginIfMissing()` is idempotent; safe to re-run `install` |
| Legacy `opencode.json` not migrated | Older consumer | `Installer.migrateRootConfig()` runs on first local install |
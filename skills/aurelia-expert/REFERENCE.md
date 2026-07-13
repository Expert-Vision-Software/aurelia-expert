# Reference — Branch table, precedence, pillar locations

## Branch table

| Branch | Leading word | Pillar skill | Fires on |
|---|---|---|---|
| scaffold | scaffold | `aurelia-foundation` | Starting a project, naming, components, AI scaffolding |
| resolve | resolve | `aurelia-runtime` | DI, routing, AppTask, events, cross-feature state |
| slice | slice | `aurelia-largespa` | Feature-first layout, scaling, hierarchical Agents.md |
| lift | lift | `aurelia-migration` | v1→v2 migration, debugging, performance |

All four branches are peers — the ladder in `SKILL.md` applies in order only when a prompt matches none precisely.

## Pillar locations

All pillars live next to this router, one folder deep:

```
skills/
├── aurelia-expert/         ← this router
├── aurelia-foundation/     ← scaffold
├── aurelia-runtime/        ← resolve
├── aurelia-largespa/       ← slice
└── aurelia-migration/      ← lift
```

## Precedence — project instructions

The active project's local Aurelia instructions file (`AGENTS.md`, `CLAUDE.md`, or repo-level conventions) overrides anything this package says. The router does not enforce project rules; the pillar skills do. The operational rules below are a common precedence surface pillars should honour by default; a project's own instructions may replace or sharpen any of these:

- `.trigger` for custom events (NOT `.delegate`)
- kebab-case element names
- `import type` for interfaces
- `.style` property binding (NOT inline `style="…${value}%"` interpolation)
- singleton DI services preferred over Event Aggregator for cross-feature state
- services return Models, not DTOs

When a pillar answer and a project rule disagree, the project rule wins. The router classifies the branch — the pillar reads the project file.

## V1 contamination guard

`au-northwind` is v1; reference it for structural patterns only — folder layout, slice boundaries, hierarchical `Agents.md`. Its API surface is v1; lift each adopted pattern through `aurelia-migration` so the result is v2-current. When a v1 API surface appears in a prompt or draft answer — `.delegate`, `<router-view>`, `PLATFORM.moduleName`, `configureRouter`, `<compose>`, `@inject`, `activate/deactivate` — branch to the migration pillar before answering.

## Branch, again

The router's leading word is **branch**. Same word lives in the description, the body ladder, the handoff section, and here — so prompts and docs that say "branch" reliably land on this skill and get routed to the right pillar.

---
name: aurelia-migration
description: Use when lifting Aurelia v1 code to v2, debugging v2 errors, or citing canonical Aurelia docs. Use when migrating from Aurelia 1, replacing PLATFORM.moduleName, switching configureRouter to @route, swapping .delegate for .trigger, fixing AUR0xxx error codes, optimizing performance with .to-view / batch(), or producing DeepWiki deep-links. Leading word — lift.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: migration
  sub-areas: v1-removals, debugging, performance, deepwiki-protocol
  leading-word: lift
  ground-truth: aurelia/aurelia/blob/master/packages/<pkg>/docs/<file>.md
---

# Aurelia Migration & Reference

**Lift** v1 code to v2 — the migration is the focal work, but this skill also
serves as the post-migration reference for debugging, performance, and ground-truth citations.

When you **lift** v1 → v2, you replace removed APIs in place, never rewrite-then-drop-in.
The three sub-areas the skill unlocks after the lift:

| Concern | Reach for | Anchor |
| :--- | :--- | :--- |
| Removed/renamed v1 API → v2 replacement | [reference/v1-removals.md](reference/v1-removals.md) | The lift table |
| AUR0xxx error code or behavior bug | [reference/debugging.md](reference/debugging.md) | "How Do I…" |
| Slow list, re-render churn, batch DOM | [reference/performance.md](reference/performance.md) | `.to-view` mandate |
| Citing canonical doc / DeepWiki URL | [reference/deepwiki-protocol.md](reference/deepwiki-protocol.md) | Link format |

## The lift step

A v1 → v2 lift is mechanical: eight APIs changed. Run the table in
`reference/v1-removals.md` once per file. The most common lift mistake is `.delegate`
on a custom event — it throws **AUR0009** at runtime, not at compile time. See that
file for the full table + one-line fix per row.

## v1 contamination guardrail

When **lifting** legacy code, the **FORBIDDEN** patterns in `reference/v1-removals.md`
throw runtime errors or silently break in v2. Never carry these patterns forward.
Prefer rewriting over `@aurelia/compat-v1` — the shim is for incremental legacy
increments, not a destination.

## Project precedence (overrides anything here)

When migrating in a project whose instructions file declares these rules, they are authoritative and override any generic Aurelia advice elsewhere in the skill package:

- **`.trigger` only for custom events**, never `.delegate` (throws AUR0009).
- **kebab-case element names only** — every old PascalCase or camelCase element
  name from v1 is invalid in v2; rename at the lift step.
- **`import type` / `export type` for interfaces** — split runtime (DI tokens,
  classes) from type-only; v1 files commonly merged them.
- **`.style` property binding** is v2-only; v1 inline `style="...${value}%"` produces
  a 0-value prod-build bug that the dev build hides.

## What this skill defers

- **Authoring new Aurelia 2 code from scratch** (conventions, feature-first layout,
  DI patterns, Model/DTO flow) → `aurelia-authoring` skill in this package.
- **Vite 8 / Babel decorator pipeline** → `aurelia-tooling` skill.
- **Testing setup** → `aurelia-testing` skill.

## "How Do I…" routing

If the question is "what was that v1 thing called in v2?" — start at
`reference/v1-removals.md`. If the question is "why does my prod build do X but dev
doesn't?" — start at `reference/debugging.md`. If the question is "my list lags
on scroll" — start at `reference/performance.md`. If the question is "what's the
canonical URL for this claim?" — start at `reference/deepwiki-protocol.md`.

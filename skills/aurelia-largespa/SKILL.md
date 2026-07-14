---
name: aurelia-largespa
description: Use when structuring a large Aurelia v2 SPA — slices the app into feature-first pages/, features/, shared/. Use when organizing folders for an enterprise Aurelia 2 app, choosing between technical-layer vs feature-first layout, configuring hierarchical Agents.md, applying thin-page orchestrators, picking service-as-store, deciding the model/DTO boundary, or referencing au-northwind structurally. Leading word — slice.
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: largespa
  sub-areas: feature-first, pages-vs-features, shared, feature-module, hierarchical-agents-md, orchestrator, service-as-store, model-dto, lazy-loading
  leading-word: slice
  focal-point: true
  ground-truth: https://docs.aurelia.io
---

# Aurelia Large-SPA Structure

Use **this slice** to organize the SPA by business capability while preserving explicit navigation and shared-infrastructure boundaries.

## Reference router

| When the task is about | Read this context |
| :--- | :--- |
| Replacing `/views`, `/models`, or `/services`; defining vertical boundaries | [reference/feature-first.md](reference/feature-first.md) |
| Choosing `pages/`, `features/`, or `shared/`; naming files; lazy route boundaries | [reference/directory-layout.md](reference/directory-layout.md) |
| Implementing a feature `index.ts`, child DI container, or local dependencies | [reference/feature-module.md](reference/feature-module.md) |
| Creating root or directory-level `Agents.md` instructions | [reference/hierarchical-agents-md.md](reference/hierarchical-agents-md.md) |
| Keeping pages thin; bindables down, events up; service-as-store | [reference/orchestrator.md](reference/orchestrator.md) |
| Separating DTOs from Models; nested conversion; request deduplication | [reference/model-dto.md](reference/model-dto.md) |
| Consulting au-northwind (**STRUCTURAL ONLY**) as historical precedent | [reference/au-northwind-pointer.md](reference/au-northwind-pointer.md) |

Read only the files selected by the task. Read every selected file completely before editing the app.

## Workflow

1. Read the repository's root and nearest directory-level `Agents.md`; local rules narrow the global rules.
2. Classify each affected file as navigation (`pages/`), business capability (`features/`), or globally registered infrastructure (`shared/`).
3. Mirror navigation in physical directories and keep one slice per feature.
4. Load the matching references above, then implement the smallest structural change.
5. Validate every affected file against the guardrails below. If one fails, fix it and repeat the check.

Completion means every changed file has one clear owner, pages contain no business logic, feature services and Models stay encapsulated, and shared resources are registered at startup.

## Project precedence

The active project's local Aurelia instructions file (`AGENTS.md`, `CLAUDE.md`, or repo-level conventions) overrides this skill. Apply these rules everywhere this skill is used unless a repository rule is stricter:

- Use the canonical `src/features/<slice>/{components,services,models}` layout with `index.ts`; keep thin navigation targets in `src/pages/` and cross-cutting resources in `src/shared/`.
- Prefer singleton DI services over `IEventAggregator`; inject `I`-prefixed interfaces with `resolve()`, never concrete service classes.
- Convert API DTOs through `Model.fromDTO()` and `Model.toDTO()`; components receive Models, never DTOs.
- Use kebab-case custom elements and filenames, `.trigger` for custom events, and `import type`/`export type` for type-only symbols.
- Register every resource placed in `shared/` globally during application startup.

## Structural guardrails

- Technical-layer top-level folders such as `views/`, `models/`, and `services/` are forbidden. A `services/` or `models/` folder is valid only inside a business feature or the prescribed `shared/` infrastructure boundary.
- Pages answer **where**; features answer **what**. Pages orchestrate declaratively and do not own domain behavior.
- Feature resources are local by default. Declare local custom elements and value converters in `@customElement({ dependencies: [...] })`.
- Lazy-load each navigation boundary with dynamic `import()` in the route's `component:` field.
- Treat au-northwind (**STRUCTURAL ONLY**) as historical architecture, never as an Aurelia v2 API source.

Use the slice layout rather than inventing an alternative while slicing an app.

## Defers to sibling skills

- Aurelia v2 component, binding, lifecycle, and DI API authoring beyond these structural patterns → `aurelia-authoring`.
- Aurelia v1-to-v2 API translation and removed API troubleshooting → `aurelia-migration`.
- Vite, Babel decorators, builds, and package configuration → `aurelia-tooling`.
- Unit, component, and end-to-end test architecture → `aurelia-testing`.

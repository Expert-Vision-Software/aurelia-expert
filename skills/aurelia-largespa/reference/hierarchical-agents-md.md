# Hierarchical `Agents.md`

Use a root file for stable Aurelia-wide constraints and a directory-level file for domain precision. The nearest file adds or narrows rules; it does not weaken root or project-level requirements.

This follows the hierarchical project pattern: the root establishes repository scope and lazily points to Aurelia instructions, while local feature guidance supplies only the context needed in that directory.

## Root responsibilities

The root `Agents.md` must mandate:

- Repository-approved Aurelia 2.x package pinning; never introduce Aurelia v1.
- Kebab-case, hyphenated custom-element and file naming.
- `resolve()`-based injection with constructor defaults for testability.
- `I`-prefixed service interfaces and DI tokens; inject interfaces, not classes.
- Feature-first `pages/`, `features/`, `shared/` boundaries.
- `.trigger` for custom events and `import type`/`export type` for type-only symbols.

Keep domain lifecycle and feature vocabulary out of the root.

```markdown
# Aurelia 2 SPA rules

- Pin all Aurelia packages to the repository-approved 2.x versions.
- Use `src/features/<slice>/{components,services,models}`; keep pages thin.
- Name custom elements and paired files in kebab-case with a hyphen.
- Resolve `I`-prefixed DI tokens with `resolve()` constructor defaults.
- Inject service contracts, never concrete service classes.
- Use `.trigger` for custom events.
- Use `import type` and `export type` for type-only symbols.
- Read the nearest directory-level `Agents.md` before changing that directory.
```

## Directory-level responsibilities

Place `Agents.md` in a feature directory when its lifecycle, cleanup, or domain boundary needs precision. It should specify:

- Scope and business vocabulary.
- Registration map: which local services are singleton or transient and why.
- The `I`-prefix reminder.
- Model/DTO conversion ownership.
- Mandatory lifecycle cleanup.
- Local resources that belong in `@customElement({ dependencies: [...] })`.

```markdown
# Orders feature rules

Scope: order search, selection, and detail display. Do not place customer administration here.

## Registration map

- `IOrderService` -> `OrderService`: singleton in the orders child container.
- `IOrderFilterValidator` -> `OrderFilterValidator`: transient; stateless and disposable.
- Keep every service token `I`-prefixed and resolve the token, not the class.

## Data boundary

- API responses enter as `OrderDTO` and leave the service as `OrderModel`.
- Use `OrderModel.fromDTO()` and `order.toDTO()`; components never receive DTOs.

## Components and lifecycle

- Declare feature-local elements and converters in `dependencies`.
- Prefer typed singleton services over `IEventAggregator`.
- Dispose of all `ea` subscriptions in `unbinding`.
```

The cleanup line remains mandatory for legacy or exceptional Event Aggregator use; new cross-component business state belongs in an explicit singleton service.

## Precedence

Apply instructions in this order:

1. The active project's local Aurelia instructions file (`AGENTS.md`, `CLAUDE.md`, or repo-level conventions), when present.
2. Root `Agents.md` global constraints.
3. Nearest directory-level `Agents.md` domain and lifecycle constraints.

A local file may choose singleton versus transient for its folder, but may not authorize technical-layer roots, concrete-class injection, DTO exposure, non-kebab names, or Aurelia v1 APIs.

## Pruning rule

Keep each rule at the narrowest stable level. Do not copy the entire root into every feature. A local file repeats only high-risk reminders required at the point of work, such as the `I` prefix and cleanup line.

## Validation

- Root rules cover version, naming, `resolve()`, and `I` prefixes.
- Every feature with special lifecycles has a local registration map.
- Every local service is explicitly singleton or transient.
- Event subscriptions have a named cleanup hook.
- Local rules add precision without contradicting higher-precedence files.

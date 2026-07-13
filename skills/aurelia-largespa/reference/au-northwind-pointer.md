# au-northwind Pointer — STRUCTURAL ONLY

> [!CAUTION]
> ## STRICT PROHIBITION — these v1 patterns are NEVER to be carried into v2 code, no matter what au-northwind's source shows.
>
> Never use `PLATFORM.moduleName`, `configureRouter`, `<router-view>`, `<compose viewModel="…">`, `.delegate`, `@inject`, or `activate/deactivate` in Aurelia v2 code.
>
> Use Aurelia v2 route dynamic imports and `<au-viewport>`, ordinary custom-element composition with local `dependencies`, `.trigger` for custom events, `resolve()` with `I`-prefixed tokens, and v2 lifecycle hooks instead. For API-by-API translation, load `aurelia-migration`.

## Historical boundary

au-northwind (**STRUCTURAL ONLY**) is an Aurelia v1 historical reference. Consult it only to understand architectural shape; use `https://docs.aurelia.io` and repository instructions for every v2 API and syntax decision.

## Patterns worth carrying forward

| Historical structural idea | Aurelia v2 application |
| :--- | :--- |
| Feature-first hierarchy | One `features/<slice>/` capability with local `components/`, `services/`, and `models/` |
| Pages/features/shared separation | Thin route pages compose business features; globally registered infrastructure lives in `shared/` |
| Encapsulation by default | Feature public `index.ts`, child DI container, and local `@customElement({ dependencies: [...] })` |
| Repository pattern | Keep persistence/API access behind a feature service or repository contract; components never call transport directly |
| DI service layer | Resolve `I`-prefixed Aurelia v2 tokens, with singleton service-as-store where state is shared |
| Behavior-driven models | Convert DTOs at service boundaries and expose Models with behavior |

Use the flow below as architecture, not as copied source:

```text
thin page -> feature component -> interface-based service/store
                                  -> repository/API adapter
                                  -> DTO conversion -> behavior-rich Model
```

## What not to copy

Do not copy route configuration, module loading expressions, view outlets, dynamic composition syntax, event commands, injection decorators, or lifecycle method names from au-northwind (**STRUCTURAL ONLY**). Even when the folder idea remains useful, rewrite implementation from Aurelia v2 ground truth.

## Review gate

Before accepting code influenced by au-northwind (**STRUCTURAL ONLY**), search the changed files for all seven prohibited v1 patterns listed in the guardrail. If any appears as executable code, replace it with the v2 target and repeat the search. Historical prose or migration tests must label the pattern as v1 and forbidden.

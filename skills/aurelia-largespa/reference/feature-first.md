# Feature-First Architecture

## Rule

Organize by business capability. Top-level technical layers such as `src/views/`, `src/models/`, and `src/services/` are forbidden because one change then requires navigation across unrelated folders.

A local technical subfolder is valid inside a capability: `features/orders/services/` contains only order behavior. The business boundary, not the file type, owns the code.

## Vertical-slice principle

The navigation hierarchy and physical hierarchy should tell the same story:

```text
Navigation                         Physical ownership
/customers                        pages/customers/ + features/customers/
/customers/:id/invoices           pages/customers/invoices/ + features/invoices/
/administration/users             pages/administration/users/ + features/user-administration/
```

Use one feature folder for one business capability. A feature owns its components, services, Models, DTO contracts, local resources, and public registration entry. A page at the matching navigation point composes those capabilities.

Do not create a feature per component. Split when a capability has its own vocabulary, state/service boundary, or independent navigation/use cases. Keep tightly coupled behavior together.

## Dependency direction

```text
pages  ──────> features ──────> shared
  └───────────────────────────> shared
```

- `pages/` may import feature public entries and shared resources.
- A feature may import its own internals and `shared/`.
- A feature must not import a page.
- `shared/` must not import a feature or page.
- Avoid feature-to-feature imports. Compose both in a page; move only a genuinely cross-cutting contract to `shared/`.

These boundaries keep a capability portable and make deletion or lazy loading predictable.

## Pages and features are not competing layouts

`pages/` is the **where**: route targets and thin layouts. `features/` is the **what**: business modules. A page can compose several features without absorbing their behavior. The two roots are architectural roles, not a return to technical-layer organization.

## Lazy boundary

Use a dynamic route component import for each navigation boundary:

```typescript
@route({
  routes: [
    {
      path: 'orders',
      component: () => import('../pages/orders/orders-page'),
      title: 'Orders',
    },
  ],
})
export class App {}
```

The page statically imports the feature components it orchestrates. The dynamic `import()` gives Aurelia 2 and the bundler a chunk boundary for that feature slice; keep unrelated features out of the page's import graph.

## Placement test

Ask in order:

1. Is it a navigation target or route layout? Put it in `pages/` and keep it thin.
2. Does it implement a named business capability? Put it in `features/<slice>/`.
3. Is it generic and required across unrelated capabilities? Put it in `shared/` and register it globally.
4. Is it used by only one feature despite looking reusable? Keep it local until a second independent consumer proves otherwise.

## Validation

- No top-level business dumping grounds named `views`, `models`, or `services`.
- Every business file has a single feature owner.
- Directory nesting reflects navigation where navigation exists.
- Page-to-feature and feature-to-shared dependencies point inward only.
- Every lazy route uses `component: () => import(...)`.

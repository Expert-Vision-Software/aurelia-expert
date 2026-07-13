# Philosophy

Answers the question agents ask before any code: *what is Aurelia, and why pick it?* Read this when the user pushes back on framework choice, when an agent needs to justify the foundation to itself, or when designing a project's architectural guardrails.

## What Aurelia *is*

Aurelia 2 is a single-page web framework built on one bet: **the browser already does the work — let it.** Templates are valid HTML enhanced with `if.bind`, `repeat.for`, and `.trigger`. View-models are plain TypeScript classes with decorators. The runtime is small, the conventions are decisive, and nothing about Aurelia hides the platform.

## Core Directives

These are the five non-negotiable tenets. Every architectural decision in an Aurelia project must satisfy at least one of them.

1. **Web Standards, Enhanced.** Build *on* the web, not *around* it. Templates are HTML; bindings (`if.bind`, `repeat.for`, `value.bind`) read as natural language and compile away. Never invent a proprietary abstraction when a CSS/JS/DOM primitive exists.
2. **Stability Over Hype.** Predictable APIs and long-term maintainability outweigh novelty. If a feature doesn't compound knowledge with the underlying web platform, it doesn't ship.
3. **Trivial Testing.** Architecture must make testing a default task, not a heroic effort. Everything injectable is mockable; no `static` singletons; no hidden globals.
4. **Unified Strike Force.** Aurelia's router, DI, binding engine, and templating are integrated. Resist "integration hell" by avoiding third-party replacements for framework concerns.
5. **Knowledge Compounding.** Every hour learning Aurelia must also teach the underlying web. The opposite (`compile-to-X` JSX/Vue-template hybrids) creates knowledge that expires with the framework.

## Convention over Configuration

The bet behind the whole framework: a deterministic default beats a tuned one. By collapsing the "decision space" (file naming, template pairing, DI registration, routing semantics), Aurelia removes the choices that cause bike-shedding and LLM hallucination. The agent and the developer reach for the same default simultaneously — that's the alignment that makes Aurelia a *predictable* foundation.

Conventions in action (full mechanics in the relevant reference):

- `name.ts` + `name.html` pair → no manual `template:` override. See [components.md](components.md).
- Kebab-case element names → required for Web Components compliance. See [components.md](components.md).
- `resolve()` for DI → no `@inject` decorator, no parameter decorators in constructors. See [components.md](components.md).
- Top-down `binding`/Bottom-up `attached` lifecycle → no special-casing for child timing. See [lifecycle.md](lifecycle.md).

## What Aurelia *isn't*

Clarity comes from contrast. Aurelia is not:

- **Not JSX.** A template is HTML with bindings, not a JS-flavored syntax dialect. `if.bind` and `repeat.for` look like English, not like `{}` expressions.
- **Not a hooks-and-reducers framework.** Components are class-based view-models with co-located state. No hook naming tax.
- **Not a fragmented ecosystem.** Router, DI, templating, animation, validation — all shipped together, all supported by the same team.
- **Not "trendy."** v1 was released in 2015; v2 stabilises what works. There is no "Aurelia 3 alpha" pressure pulling the foundation.
- **Not a runtime that hides HTML.** Slots, Shadow DOM, custom elements, and templates are the surface — you see them, you debug them.

## The Aurelia Philosophy, in one sentence

> Build on the web, not around it. Convention over configuration. Stability over hype. Trivial testing. Unified ecosystem.

That sentence is the test for "should this decision be in an Aurelia project?" If a proposed pattern violates any clause, it isn't Aurelia.

## When to lean on philosophy vs. when to defer

- **Reach for philosophy** when: a teammate or agent proposes a `useReducer`-style global store, a JSX-like syntax extension, a third-party router, or "trendy" patterns Aurelia doesn't ship.
- **Defer to philosophy** when: the task is purely mechanical (add a `@bindable`, extend a route). Use the component/lifecycle reference, not this file.

For the actual scaffold steps, jump to [quickstart.md](quickstart.md).

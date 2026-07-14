---
name: aurelia-expert
description: Use ONLY when working in an Aurelia v2 project — branch picks the right pillar skill for scaffold, resolve, slice, lift, or assemble questions on Aurelia 2.x MVVM SPAs. Use when starting an Aurelia app, choosing between Aurelia skills, structuring a large SPA, dependency injection, routing, migration from v1, debugging, performance, building a component library, or AI-assisted Aurelia scaffolding. Front-loads the leading word "branch".
license: MIT
compatibility: opencode, claude-code, and any skill-compatible agent
metadata:
  area: router
  leading-word: branch
  ground-truth: https://docs.aurelia.io
---

# Aurelia Expert — Router

A thin router. It reads the prompt, classifies it as one of five branches, and hands off to the named pillar skill. It holds no Aurelia domain content itself.

The five branches — scaffold, resolve, assemble, slice, lift — map one-to-one to the five pillar skills. The router's job is to pick the right one and stop.

## Branch detection ladder

Read the prompt. Match the first branch whose trigger is present. Use the order below so more specific branches win over generic ones.

1. **scaffold → `aurelia-foundation`.** Triggers: "start an Aurelia project", "what is Aurelia's philosophy", "name a component", "scaffold a new feature", "create a custom element", "use AI to scaffold Aurelia".
2. **resolve → `aurelia-runtime`.** Triggers: "inject a service", "resolve dependency", "add a route", "configure AppTask", "share state between features", "navigate programmatically".
3. **assemble → `aurelia-component-library`.** Triggers: "component library", "design system", "UI kit", "extract components into a library", "CSS variables for components", "tokens", "Tailwind component library", "shared button kit".
4. **slice → `aurelia-largespa`.** Triggers: "structure a large Aurelia app", "feature-first layout", "organize folders", "split into features", "share code across features", "configure Agents.md", "scale an Aurelia SPA".
5. **lift → `aurelia-migration`.** Triggers: "migrate from Aurelia 1", "lift v1 code", "what changed in v2", "debug this Aurelia error", "optimize performance", "find the canonical doc".

## Handoff

Once classified, branch to the named pillar via the `skill` tool. Pass the user's prompt through unchanged.

```
skill({ name: "aurelia-foundation" })        // scaffold
skill({ name: "aurelia-runtime" })          // resolve
skill({ name: "aurelia-component-library" }) // assemble
skill({ name: "aurelia-largespa" })          // slice
skill({ name: "aurelia-migration" })         // lift
```

Hand off the user's prompt unchanged. Leave the pillar's domain to the pillar. Pick one branch; answer from that pillar alone.

When two branches both fit (e.g. "migrate this large Aurelia app"), branch to the more specific one first: `aurelia-migration` owns the structural lift, and `aurelia-largespa` answers the post-migration organisation questions that surface once the lift lands. Default to migration; defer to largespa only when the prompt is purely about layout, not the lift itself.

Library-building is a third axis of overlap. When the prompt mixes library construction with v1→v2 migration ("move my v1 buttons into a v2 component library"), the more constrained case wins: branch to `aurelia-migration` first so v1 syntax becomes v2-current, then load `aurelia-component-library` to assemble the lifted v2 code into the kit. The component-library pillar's migrate procedure runs the v1-syntax gate before any structural move; honour that gate by lifting first.

## Precedence

The active project's local Aurelia instructions file (its `AGENTS.md`, `CLAUDE.md`, or repo-level conventions) overrides anything this package says. The router does not enforce project rules — the pillar skills do. See [REFERENCE.md](REFERENCE.md) for the precedence surface and where each pillar lives.

## V1 contamination guard

`au-northwind` is v1. Reference it for structural patterns only — folder layout, slice boundaries, hierarchical `Agents.md`. Its API surface is v1; lift each adopted pattern through `aurelia-migration` so the result is v2-current. When a v1 API shows up in a prompt or a draft answer (`.delegate`, `<router-view>`, `PLATFORM.moduleName`, `configureRouter`, `<compose>`, `@inject`, `activate/deactivate`), branch to the migration pillar to convert it before answering.

## Closing

This router's leading word is **branch**. Same word in the description, in the body, in each handoff, and at the bottom of [REFERENCE.md](REFERENCE.md) — so prompts that say "branch to the right Aurelia skill" land here reliably. The router picks the branch; the pillar owns the answer.

# AI-assisted scaffolding

How to use an AI agent (Claude, Cursor, NotebookLM) to scaffold Aurelia code without hallucinating v1 patterns or stale APIs. The work has three layers: ground-truth sources, prompt templates that anchor the agent to those sources, and a feedback loop that verifies outputs.

## Why scaffolding an Aurelia agent is non-trivial

Aurelia's pre-training footprint is smaller than React's, and Aurelia 1 / Aurelia 2 API surfaces overlap on vocabulary while diverging on semantics. An agent without explicit grounding will produce v1 patterns (`PLATFORM.moduleName`, `configureRouter`, `.delegate` on custom events) that *look* right and break at runtime. The scaffold here is designed to make those breaks impossible.

## Layer 1 — Ground truth

Pick a single ground-truth source and forbid the agent from answering questions it cannot cite.

| Source | URL | Use for |
|---|---|---|
| Aurelia docs (canonical) | `https://docs.aurelia.io` | All API questions |
| DeepWiki (deep-link format) | `aurelia/aurelia/blob/master/packages/<pkg>/docs/<file>.md` | Specific package docs, e.g. `@aurelia/router`, `@aurelia/kernel` |
| GitHub source | `https://github.com/aurelia/aurelia` | When docs are silent (latest unreleased APIs) |

**Prohibition:** Any reference to v1, blog posts older than 2022, or third-party tutorial sites must be ignored. The agent answers "I don't have a v2 reference for that" instead of guessing.

## Layer 2 — Prompt scaffolds

Three prompt shapes cover most scaffolding work. Each has an explicit grounding clause the agent cannot skip.

### (a) The *Foundation* prompt — "scaffold a new project"

Use when the user says "scaffold this", "set up Aurelia", or any first-green-field task. The prompt template:

> You are scaffolding an Aurelia 2 project. **Only Aurelia 2.** Use `npx makes aurelia my-app` with the Vite + TypeScript stack. Pick kebab-case element names, the `name.ts` + `name.html` pairing convention, and the `resolve()` DI function — never `@inject`. Bootstrap with `Aurelia.app(MyApp).start()`; do not introduce `PLATFORM.moduleName`. **Ground-truth:** `https://docs.aurelia.io`. For any API you cite, give the `aurelia/aurelia/blob/master/packages/...` deep-link. If you cannot find a v2 reference, say so — do not invent.

Add this final clause (mirrors [SKILL.md Hard guardrails](../SKILL.md#hard-guardrails-apply-to-every-branch)):

> Bind events with `.trigger` for custom events. Use `import type` / `export type` for interfaces; runtime imports for DI tokens. Use `.style` property binding for dynamic CSS — never inline `style="...${value}%"` interpolation.

### (b) The *Component* prompt — "scaffold a custom element"

Use when the agent must generate one component. Template:

> Scaffold `<user-profile>` for an Aurelia 2 app. Folder: `src/components/user-profile/`. File pair: `user-profile.ts` + `user-profile.html`. No manual `template:` override. Declare local resources in `dependencies: [...]`. Expose props with `@bindable` and choose `.bind` / `.to-view` / `.from-view` based on intent. **Ground-truth:** `https://docs.aurelia.io` and the `@aurelia/runtime-html` docs.

Always finish with a verification step the agent must perform:

> Before finishing, list every `AURxxxx` error the change could throw (from your ground truth) and confirm none apply.

### (c) The *Lifecycle* prompt — "wire hooks and disposal"

For components that fetch data or subscribe to events:

> Wire the lifecycle for `<user-profile>`. `binding()` may return a Promise to block child hydration. Use `attached()` for any DOM measurement or 3rd-party UI init. **All** subscriptions, intervals, and observers must be disposed in `unbinding`. **Ground-truth:** `https://docs.aurelia.io` — search for the lifecycle diagram and cite the file. Do not use the v1 `activate`/`deactivate` hooks — those are gone.

## Layer 3 — NotebookLM as ground truth

NotebookLM-ingests the Aurelia docs and gives the agent a sandboxed corpus. The pattern:

1. Create a NotebookLM notebook titled "Aurelia 2 Foundation".
2. Ingest as sources:
   - `https://docs.aurelia.io` (or a curated subset of pages: getting-started, components, lifecycle, router).
   - The two Notion reports in the local `.cache/` if present (one covers "Global Technical Standards for LLM-Powered Aurelia v2 Agentic Teams"; the other "Aurelia 2 Enterprise Technical Standards Manual").
   - The DeepWiki overview: `https://deepwiki.com/aurelia/aurelia`.
3. In the notebook chat, ask:
   > "Given only these sources, scaffold an Aurelia 2 hello-world. Cite the source for each step. If a step is not covered, say so."
4. Then ask:
   > "List any v1 patterns (`PLATFORM.moduleName`, `configureRouter`, `<router-view>`, `<compose>`, `.delegate` on custom events, `@inject` decorator, `activate`/`deactivate` hooks) that appear in the generated code, and replace each with the v2 equivalent. Cite the replacement's source."

The second pass is the feedback loop. NotebookLM's grounding prevents the agent from importing the v1 patterns it learned during pre-training.

## Layer 4 — DHB "deep-research" prompts

The **Deep Hybrid Bench (DHB)** pattern — running two complementary research calls in parallel and reconciling — is the most reliable way to scaffold a non-trivial feature.

For each scaffolding step, run two requests in parallel:

1. **Doc-grounded query** (NotebookLM or `https://docs.aurelia.io`): produces an answer traceable to a specific page in v2 docs.
2. **Code-grounded query** (DeepWiki or `https://github.com/aurelia/aurelia/find/master`): produces an answer with a real, current method signature from the source.

Reconcile: if the doc says one thing and the code says another, **the code wins** and the doc citation is updated. If neither covers the question, the agent must say so and propose a fallback, not invent.

Concretely for "scaffold a custom element with lifecycle hooks":

```
Doc:   "What hooks does an Aurelia 2 component expose, in what order?"
Code:  "Search the aurelia/aurelia repo for `ICustomElementController.lifecycleHooks`
        and return the canonical hook order, with file:line citations."
```

The reconciliation step is what makes the scaffold stable: a single research pass drifts with the model's prior; the doc+code pair does not.

## Failure modes to guard against

| Symptom | Cause | Fix |
|---|---|---|
| `AUR0009` on a custom event | Agent used `.delegate` on a custom event | Re-prompt with the **Hard guardrails** clause from [SKILL.md](../SKILL.md) verbatim |
| `style="width:{};"` in prod bundle | Agent used inline interpolation | Re-prompt with the `.style` property binding rule verbatim |
| Module not found, runtime error on first import | Agent used a runtime `import` for an interface | Re-prompt: split into `import type` and regular `import` per `verbatimModuleSyntax: true` |
| `PLATFORM is not defined` | Agent imported v1 module | Forbid v1; cite the v2 equivalent each time |
| `configureRouter is not a function` | Agent generated v1 router config | Use `@route` + `<au-viewport>`; cite `@aurelia/router` docs |
| Memory leak after route changes | Agent subscribed in `attached`, never disposed | Force the disposal assertion: every `subscribe(...)` → `unbinding` `dispose()` |

## Verification ladder

After any scaffold:

1. `bun run build` (or `npm run build`) — checks TypeScript against `verbatimModuleSyntax: true`, isolating the `import type` violation class.
2. `bun run dev` — manual smoke; the page renders, the binding works.
3. `bun run preview` after `bun run build` — surfaces the prod-only `.style` interpolation bug.
4. Open browser devtools → Memory → take heap snapshots, navigate, return, snapshot. Verify heap returned to baseline (catches `unbinding` leaks).

If any step fails, return to the **Foundation** prompt and re-issue with the failure message pasted in. Do not patch forward — re-issue the scaffold with the failure as ground truth.

## Quick links back

- For the framework *what* and *why*: [philosophy.md](philosophy.md).
- For the actual `npx` + `main.ts` steps: [quickstart.md](quickstart.md).
- For the view-model + template mechanics: [components.md](components.md).
- For the hook order and disposal mandate: [lifecycle.md](lifecycle.md).

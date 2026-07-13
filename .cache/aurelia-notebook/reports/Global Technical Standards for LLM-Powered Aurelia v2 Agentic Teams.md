# Global Technical Standards for LLM-Powered Aurelia v2 Agentic Teams

## 1. Executive Mandate: The 'Convention over Configuration' Philosophy

In high-scale autonomous development, the primary bottleneck is the "decision space"— the entropic explosion of architectural choices that leads to LLM hallucination and technical debt. This document mandates **Convention over Configuration (CoC)** as the absolute alignment mechanism for our agentic strike force. By enforcing deterministic defaults, we collapse the decision space, allowing agents to bypass boilerplate and focus exclusively on business logic.

Aurelia 2 is built on a defiant core philosophy: "We build on the web, not around it." We refuse the industry's "insanity" of reinventing web standards or requiring proprietary magic to perform simple tasks. Because Aurelia uses "natural language" templates (e.g., `if.bind`, `repeat.for`), an LLM's native understanding of HTML is enhanced rather than discarded. Choosing this framework means choosing stability over hype and standards over novelty.

### Core Architectural Pillars

| Feature | The React Default (Modular Freedom) | The Aurelia 2 Standard (Cohesive Strike Force) | Impact on Agentic Predictability |
| :--- | :--- | :--- | :--- |
| **Ecosystem** | Fragmented third-party libraries | Unified, integrated framework core | **High:** Context remains stable across modules. |
| **Logic Location** | Dispersed (Hooks, Context, Reducers) | Co-located (Class-based components) | **High:** LLMs find state/logic in predictable pairs. |
| **Standards** | Custom JSX/TSX abstractions | Enhanced Web Standards (HTML/CSS) | **Medium:** Reduces syntax errors via native knowledge. |
| **Configuration** | High (High "Bike-shedding" overhead) | Low (Conventions drive the structure) | **Critical:** Eliminates hallucination in setup phases. |

The following standards are not suggestions; they are the architectural guardrails required for autonomous coordination.

---

## 2. Structural Standards: Feature-First Architecture

Technical-layer organization (e.g., grouping by `/views`, `/models`, or `/services`) is strictly forbidden. This legacy sprawl increases cognitive load and causes "context fragmentation" for LLMs. Projects must adopt a **Feature-First Architecture**, grouping files by business capability to maximize cohesion and reduce cross-directory navigation.

### Mandatory Feature Module Pattern
Every business unit must be a self-contained module. To ensure strict encapsulation, the `index.ts` of a feature must act as a **Feature Module**, utilizing a `static register` method to manage its own child container scope.

**Example Directory Tree (`/src/features/orders`):**
```text
src/features/orders/
├── components/          # Local UI elements (order-row.ts/html)
├── hooks/               # Feature-specific logic hooks
├── services/            # Domain-specific services (using IOrderService)
├── orders.ts            # Feature View-Model
├── orders.html          # Feature Template
└── index.ts             # Feature Module (Entry Point)
```

**Feature Module Registration (`index.ts`):**
```typescript
import { IContainer, Registration } from '@aurelia/kernel';
import { OrderService, IOrderService } from './services/order-service';

export const OrdersFeature = {
  register(container: IContainer): IContainer {
    // Create feature-scoped child container
    const child = container.createChild();
    child.register(Registration.singleton(IOrderService, OrderService));
    return child;
  }
};
```

Encapsulation is the default. Agents must localize custom elements and value converters within the feature’s `@customElement` dependencies array to minimize global namespace pollution and keep context windows focused.

---

## 3. The Agentic Coordination Layer: Hierarchical Agents.md

Traditional documentation is too static for autonomous agents. We utilize a **Hierarchical AI Documentation Strategy** to provide "Just-In-Time" context, telling the agent the local rules before a single line of code is generated.

### Hierarchical Strategy Definitions
*   **Root `Agents.md`**: Global framework guardrails. Mandates Aurelia 2.x, version pinning, hyphenated naming, and the absolute requirement for the `resolve()` function.
*   **Directory-Level `Agents.md`**: Domain-specific precision. This provides context for local services, specialized DI resolvers, and routing requirements for that specific feature.

### Agent Directives: `src/features` Level
When generating new features, agents must adhere to the following directive:
> "You are strictly required to use the Feature Module Pattern. Register all domain-specific services via a `static register` method in the `index.ts`. Local UI dependencies (Value Converters, Child Elements) must be explicitly declared in the `@customElement` dependencies array to ensure the module is portable and tree-shakable."

---

## 4. Engineering Standards: Modern Dependency Injection (DI)

We have moved away from decorator-heavy DI to a functional resolution approach. This improves TypeScript type inference and ensures that testing remains trivial rather than "heroic."

### The `resolve()` Mandate
The `resolve()` function is **mandatory**. The legacy `@inject` decorator and the use of decorators within constructor parameters (e.g., `@ILogger private logger`) are **strictly forbidden**.

```typescript
// MANDATED: Class Property Resolution
export class OrderService {
  private logger = resolve(ILogger); // Correct
  private api = resolve(IApiClient);  // Correct
}
```

### Agentic Resolvers (Advanced Patterns)
Agents must use advanced resolvers to handle complex scoping and lifecycle requirements:
*   **`lazy(Key)`**: For deferred resolution of expensive services or breaking circular dependencies.
*   **`all(Key)`**: To collect all registered implementations of a specific interface (e.g., a plugin system).
*   **`newInstanceForScope(Key)`**: Specifically for `IValidationController` to ensure state is localized to the component and cleaned up automatically.
*   **`optional(Key)`**: For pluggable features where the application should not break if the dependency is missing.

### Interface-Based DI
Inject by contract, not by concrete class. Use `DI.createInterface<T>('TokenName')` to enable deterministic mocking and architectural flexibility. The DI registry serves as the deterministic contract for the following UI layer.

---

## 5. Component Standards & Lifecycle Protocols

Components must align with Web Standards to ensure long-term maintainability and predictable agentic output.

### Component Mandates
*   **Naming**: Custom elements **must** have hyphenated names (e.g., `user-profile`).
*   **Pairing**: Components follow an explicit `name.ts` and `name.html` pairing.
*   **Local Resources**: Use the `dependencies` property in the `@customElement` decorator for all local resources.

### Lifecycle Execution Order Map
Agents must adhere to the following execution order to manage complex DOM hierarchies and prevent memory leaks:

1.  **`binding` / `bound` / `attaching`**: Executes **Top -> Down** (Parent before Child). `binding` can return a Promise to block child hydration.
2.  **`attached`**: Executes **Bottom -> Up** (Children before Parent). Use for DOM measurements.
3.  **`detaching` / `unbinding`**: Executes **Top -> Down**.

**Mandatory Cleanup**: The `unbinding` hook is the primary location for disposing of **Event Aggregator** subscriptions and other long-lived listeners. Failure to do so constitutes a critical error.

---

## 6. Navigation & Routing Protocols

Aurelia 2 replaces monolithic, centralized routing with a **declarative, feature-nested navigation** model.

### Declarative Routing & Syntax
Agents must use the `@route` decorator co-located with feature components. We mandate a **File-System Syntax** for path resolution to preserve module portability:
*   `/path`: Absolute root.
*   `./path`: Local context.
*   `../path`: Ancestor context.

### Context-Aware Navigation
Agents should prefer `IContextRouter` over the global `IRouter` to resolve relative paths like `../details`.

```typescript
export class OrderDetails {
  private contextRouter = resolve(IContextRouter);

  async goBack() {
    await this.contextRouter.load('../list'); // Deterministic relative navigation
  }
}
```

---

## 7. Application Coordination: App Tasks

**App Tasks** are the strategic hooks for cross-cutting concerns. They execute during the framework's internal compiler phases.

### Lifecycle Phases
*   **`creating`**: Last chance to register dependencies before the root component is instantiated.
*   **`hydrating`**: Runs after root view instantiation, but before child compilation.
*   **`hydrated`**: Runs after root self-hydration; use for telemetry or global state setup.
*   **`activating`**: Scope hierarchy formed; ideal for role-based feature loading.
*   **`activated`**: App is fully running.
*   **`deactivating`**: Save application state before stopping.
*   **`deactivated`**: Final post-shutdown cleanup.

**Example: Asynchronous Hydrating Task**
```typescript
Aurelia.register(
  AppTask.hydrating(IContainer, async container => {
    const featureFlags = await import('./config'); // Dynamic import
    Registration.instance(IFeatureFlags, featureFlags.default).register(container);
  })
);
```

---

## 8. Reference Protocol: DeepWiki Deep-Linking

To ensure deterministic reasoning and prevent version confusion, all technical references must cite the **Ground Truth** using the DeepWiki format.

*   **Mandatory Link Format**: `aurelia/aurelia/blob/master/packages/[package-name]/docs/[file].md`
*   **Version Prohibition**: Any reference to Aurelia v1 or non-DeepWiki documentation is strictly forbidden.

**Citing Ground Truth Examples:**
*   When implementing Dependency Injection, refer to: `aurelia/aurelia/blob/master/packages/kernel/docs/di-overview.md`
*   When implementing relative routing, refer to: `aurelia/aurelia/blob/master/packages/router-lite/docs/navigating.md`

These standards are the final authority for all autonomous agent reasoning within this ecosystem.
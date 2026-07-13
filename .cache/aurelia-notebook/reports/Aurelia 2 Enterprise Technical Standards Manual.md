# Aurelia 2 Enterprise Technical Standards Manual

## 1. Core Framework Philosophy and Mandates

Aligning enterprise development with Aurelia 2’s core philosophies is a strategic mandate. By adhering to "Convention over Configuration" and "Web Standards, Enhanced," we eliminate the industry insanity of reinventing the wheel every eighteen months. This standard ensures that our technical knowledge compounds rather than expires, creating a stable foundation where the framework enhances the native web platform rather than replacing it with proprietary abstractions.

### Core Directives

To maintain our standing as a high-performance engineering organization, all projects must adhere to these "Core Directives":

*   **Web Standards, Enhanced:** Build on the web, not around it. Leverage native HTML, CSS, and JS; do not hide them behind proprietary abstractions.
*   **Stability Over Hype:** Prioritize predictable APIs and long-term maintainability over the "latest hotness." We would rather be right than trendy.
*   **Trivial Testing:** Architecture must ensure that testing remains a standard task, not a heroic effort. Everything must be injectable and mockable.
*   **Unified Strike Force:** Utilize Aurelia’s integrated ecosystem (router, DI, binding) as a cohesive unit. Avoid "integration hell" caused by cobbling together incompatible third-party libraries.
*   **Knowledge Compounding:** Ensure that every hour spent learning the framework is also an hour spent mastering the underlying web platform.

The impact of "Convention over Configuration" on team velocity is profound. By relying on framework defaults, we eliminate "meaningless choices" that lead to bike-shedding and integration friction. This liberation allows the engineering team to focus exclusively on shipping business value rather than debating directory structures.

*Adherence to these philosophies begins with strict naming and structural conventions required for global compliance.*

---

## 2. Naming Conventions and Component Architecture

Strict naming conventions are not stylistic suggestions; they are required for compliance with global Web Component standards and Aurelia’s discovery engine. Proper naming ensures browser-level recognition and prevents collisions with future HTML specifications.

### Custom Element Naming
All Custom Elements **must** use hyphenated (kebab-case) names (e.g., `user-profile`).
**The "So What?":** Native browser compliance requires a hyphen to distinguish custom tags from standard HTML elements. This ensures your components remain valid as the Web Components standard evolves.

> ### **Standard Operating Procedure: The Pairing Convention**
> Aurelia 2 automatically associates `.ts` (view-model) and `.html` (template) files sharing the same base name. 
> **Mandate:** Manual template overrides via decorators are strictly forbidden. You must rely on the convention of pairing `name.ts` and `name.html` to maintain codebase predictability.

### Resource Mapping Standard

| Technical Intent | Aurelia Resource Type | Standard Registration Site |
| :--- | :--- | :--- |
| **Shared State / Logic** | Service (Class) | Root Container (Singleton) |
| **Reusable UI** | Custom Element | Local Feature / Component |
| **Logic-Only UI Modifier** | Custom Attribute | `src/shared/attributes` |
| **Data Formatting / Pipes** | Value Converter | `src/shared/value-converters` |
| **Logic Scoping** | InstanceProvider | Parent Feature Container |

**prescriptive Requirement:** Any resource defined in the `shared` directory **must** be registered in the root container during the application startup to ensure global availability.

*Standardizing our components allows us to wire them together using modern, type-safe resolution patterns.*

---

## 3. Standardized Dependency Injection (DI) with `resolve()`

The shift from legacy decorators to the functional `resolve()` function is an absolute mandate. This improves TypeScript type inference, supports inheritance natively, and provides the architectural flexibility required for enterprise-scale graphs.

### The Resolution Mandate
Use of the `resolve()` function is **mandatory**. The legacy `@inject` decorator is strictly forbidden in constructors.

### Interface-Based DI
To ensure decoupled architecture and trivial testing, you must inject by contract using `DI.createInterface`. 

**Mandatory "I-Prefix" Standard:** All injection tokens for interfaces must be prefixed with `I` (e.g., `IUserService`) to provide immediate semantic clarity to both developers and AI agents.

```typescript
// Define the contract and create the token
export interface IUserService {
  getUser(id: string): Promise<User>;
}
export const IUserService = DI.createInterface<IUserService>('IUserService');

// Standard Resolution
export class ProfileComponent {
  private userService = resolve(IUserService);
}
```

### Registration Lifecycles
*   **Registration.singleton:** One instance per container. Use for `AuthService` or `ApiClient`.
*   **Registration.transient:** Fresh instance per resolution. Use for `FormValidator`.
*   **Registration.instance:** Pre-created object. Use for third-party library wrappers.
*   **Registration.callback:** Executed per resolution. Use for dynamic logic.
*   **Registration.cachedCallback:** **Enterprise Standard** for expensive computations (e.g., parsing a base HREF). Runs once and caches the result.

### Circular Dependency Remediation
Circular dependencies must be resolved using the `lazy()` resolver to defer instantiation until the dependency is explicitly called.

```typescript
export class ServiceB {
  // Break the loop: ServiceA is only resolved on demand
  private getA = resolve(lazy(IServiceA));
  
  public execute() {
    this.getA().doWork();
  }
}
```

*Logical dependency resolution is maximized only when the physical organization mirrors business capabilities.*

---

## 4. Feature-Based Project Organization

Technical-layer organization (folders like `/views` or `/services`) is forbidden. Enterprise applications must utilize a **Feature-First Architecture** grouped by business capability.

### The "Feature Slice" Standard
A feature slice (e.g., `src/features/orders/`) must contain its own components, services, and models. This maximizes cohesion and reduces cognitive load when maintaining specific domains.

### Encapsulation by Default
To prevent global namespace pollution and enable efficient tree-shaking, features must utilize the `dependencies` property in the `@customElement` decorator. 

```typescript
@customElement({
  name: 'order-list',
  template,
  dependencies: [DateValueConverter, OrderItemComponent] // Encapsulated resources
})
export class OrderList {}
```

### The "Shared" Directory
Global cross-cutting concerns (e.g., UI kits, common utilities) reside in `src/shared/`.

*Physical structure is documented to facilitate AI-assisted workflows via standardized agent files.*

---

## 5. Hierarchical AI Documentation Strategy (Agents.md)

To optimize the codebase for AI coding agents (Claude Code, Cursor), implement a hierarchical documentation layer. This provides "Just-In-Time" (JIT) context and prevents LLM hallucinations.

### The Root `Agents.md`
Established at the project root, this file mandates:
*   **Version Pinning:** Aurelia 2.x and TypeScript.
*   **Core API Mandates:** Use of `resolve()` and the "I-prefix" for interfaces.
*   **Naming Standards:** Kebab-case custom elements.

### Directory-Specific `Agents.md`
Local agent files provide localized rules. They must document the **Registration Lifecycle** (singleton vs. transient) used in that folder to prevent AI-generated architectural errors.

### AI Optimization Checklist:
- [ ] **Registration Map:** Explicitly list if services in this folder are singletons or transients.
- [ ] **I-Prefix Enforcement:** Remind agent to use `IApiService` style tokens.
- [ ] **Local Lifecycle Rules:** Define mandatory cleanup (e.g., "Dispose of all `ea` subscriptions in `unbinding`").

*Routing standards further extend this logic by co-locating navigation with feature code.*

---

## 6. Routing and Navigation Standards

Aurelia 2 moves navigation from central config to component-owned routing using the `@route` decorator.

### Context-Aware Navigation
To ensure component portability, use `IContextRouter` for relative path resolution. This allows features to be moved within the project without breaking internal links.

```typescript
export class FeatureComponent {
  private contextRouter = resolve(IContextRouter);

  async viewDetails(id: string) {
    // Navigates relative to current context
    await this.contextRouter.load(`../details/${id}`);
  }
}
```

### Route Parameter Strategies
When deep-nesting components, call `getRouteParameters()` on `IRouteContext`. Use the appropriate `mergeStrategy`:
*   **parent-first:** Ancestor segments win on duplicate keys.
*   **append:** Returns ordered arrays for full lineage.
*   **by-route:** Maps values keyed by the route ID.

*Navigation flow ultimately triggers the critical component lifecycle phases.*

---

## 7. Lifecycle Management and Performance

Neglecting lifecycle cleanup is the primary cause of memory leaks in enterprise SPAs. Adherence to the following map is mandatory.

### Technical Lifecycle Map

| Phase | Hook | Mandatory Action / Enterprise Risk |
| :--- | :--- | :--- |
| **Binding** | `binding` | Initialize data. **Note:** Returning a Promise here blocks child hydration for orchestration. |
| **DOM Entry** | `attached` | 3rd-party library initialization and DOM measurements. |
| **DOM Exit** | `detaching` | Teardown of 3rd-party UI components. |
| **Unbinding** | `unbinding` | **Hard Mandate:** Dispose of all `IEventAggregator` subscriptions and manual listeners. Failure causes memory leaks. |

> ### **Standard Operating Procedure: High-Frequency Data**
> For real-time dashboards or high-frequency updates, use `.to-view` binding. 
> **Mandate:** `.bind` should be the default, but `.to-view` is mandatory for performance-critical data to skip unnecessary DOM observation.

*The final tier of the standard involves the environment configuration and build pipeline.*

---

## 8. Build Tooling and Environment Configuration

### Standardization
*   **Vite:** Mandatory for new projects due to HMR speed.
*   **Webpack:** Permitted only for legacy plugin requirements.
*   **Type Safety:** All projects must include `html.d.ts` to ensure template-to-script type safety.

### Environment-Based Configuration
Register environment-specific interfaces (e.g., `IApiConfig`) during the `creating` phase of the **App Task** lifecycle. This ensures the root component is hydrated with the correct config immediately.

```typescript
// main.ts
Aurelia.register(
  AppTask.creating(IApiConfig, container => {
    const config = process.env.NODE_ENV === 'production' 
      ? prodConfig 
      : devConfig;
    Registration.instance(IApiConfig, config).register(container);
  })
)
```

Adherence to these standards ensures our codebase remains a cohesive strike force, perfectly aligned with the Aurelia philosophy of building sustainable, high-performance enterprise applications.
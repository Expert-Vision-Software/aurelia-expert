# Quickstart

The minimum path from `npx` to a running app with one component on screen. Five steps, each a completion criterion; if any step is unclear, stop and read the matching reference.

## 0. Pre-flight

Verify the toolchain. If any of these fail, install before proceeding.

```bash
node --version          # ≥ 18
npm --version
bun --version           # recommended; npm/pnpm work too
```

Optional but recommended: a register-free TypeScript-friendly runtime. Bun is the project's preferred scaffold because `bun run` is fastest.

## 1. Scaffold the project

```bash
npx makes aurelia my-app
cd my-app
```

The CLI asks for stack choices. **Pick:**

- **Bundler:** Vite (required for HMR speed; Webpack only for legacy plugin reasons).
- **Language:** TypeScript.
- **CSS:** plain CSS or Tailwind (your call; Light DOM + Tailwind is the typical default).
- **Linter:** ESLint (default).

Project shape after `makes`:

```
my-app/
├── src/
│   ├── main.ts              # bootstraps Aurelia
│   ├── my-app.ts            # root view-model
│   ├── my-app.html          # root template
│   ├── environment.ts       # dev/prod env switch
│   └── styles/              # global CSS
├── package.json
├── tsconfig.json            # verbatimModuleSyntax: true
└── vite.config.ts
```

**Completion criterion:** project builds with `bun run build` or `npm run build` even before any edits.

## 2. Bootstrap with `Aurelia.app(...).start()`

Open `src/main.ts`. The default already wires `Aurelia.app(MyApp).start()`. The shape is:

```typescript
import { Aurelia } from 'aurelia';
import { MyApp } from './my-app';
import './styles/global.css';

Aurelia
  .app(MyApp)
  .start();
```

- `Aurelia.app(Root)` registers the root view-model; the convention pairs it with `my-app.html` in the same folder.
- `.start()` returns a Promise; call it at module load (top-level `await` in an ES module is supported in Vite/Tsc).
- For environment-specific config, use `Aurelia.register(AppTask.creating(...))` (see [lifecycle.md](lifecycle.md) for App Tasks).

**v1 contamination to avoid:** `PLATFORM.moduleName(...)` is **gone** in v2. The convention is the convention; the file system pair handles resolution. Never add `PLATFORM.moduleName`.

**Completion criterion:** `bun run dev` opens the browser to a page without console errors.

## 3. The `name.ts` + `name.html` pair convention

Every component lives in two siblings with the same base name:

```
src/components/hello/
├── hello.ts         # view-model class
└── hello.html       # template
```

The runtime pairs them by basename. **Manual `template:` overrides are forbidden** — they break the convention-driven resolution and surprise every agent reading the code.

The `name.ts` file is a plain TypeScript class; the `name.html` file is valid HTML with `.bind` / `.trigger` / `.repeat.for` enhancements.

**Completion criterion:** a new folder under `src/components/` with a `.ts` and `.html` of the same base name appears in the project tree.

## 4. Build the first component

Add a root-level component that consumes a child pair.

`src/my-app.ts` (root view-model):

```typescript
import { resolve } from 'aurelia';
import { IHelloService, HelloService } from './shared/hello/hello.service';
import './components/hello/hello';    // registers <hello>

export class MyApp {
  private helloService = resolve(IHelloService);
}
```

`src/my-app.html` (root template, two-way bound to a child):

```html
<import from="./components/hello/hello"></import>

<hello></hello>
```

`src/components/hello/hello.ts`:

```typescript
import { customElement, bindable } from 'aurelia';

@customElement('hello')
export class Hello {
  @bindable public name: string = 'world';

  public get message(): string {
    return `Hello, ${this.name}!`;
  }
}
```

`src/components/hello/hello.html`:

```html
<h1>${message}</h1>
<input value.bind="name" />
```

**Hard guardrails to enforce on first scaffold:**

- Element name is **kebab-case** with a hyphen. `hello` is fine; `HelloWorld` is forbidden.
- Interface token: PascalCase `I`-prefix (`IHelloService`). Import with **`import type { IHelloService }`** so `verbatimModuleSyntax: true` strips it at runtime.
- Bindable defaults to two-way (`.bind`); for read-only use `.to-view`.
- For dynamic CSS, use `.style` property binding (e.g., `width.style="pct + '%'"`).

**Completion criterion:** the page shows `Hello, world!`, typing in the input updates it live.

## 5. Run, build, verify

```bash
bun run dev          # vite dev server with HMR
bun run build        # production build to dist/
bun run preview      # serve the production build locally
```

**Mandatory verification:** `bun run build` must complete without TypeScript errors. If the project enforces `verbatimModuleSyntax: true` in `tsconfig.json`, every `import type` is checked at compile time — fix any runtime import of an interface there.

**Completion criterion:** production build succeeds; `bun run preview` serves the page; the component is visible and interactive.

## After scaffold: where to go next

| Need | Reference |
|---|---|
| Create another custom element with bindables / dependencies | [components.md](components.md) |
| Add lifecycle hooks (data fetch in `binding`, dispose in `unbinding`) | [lifecycle.md](lifecycle.md) |
| Justify the framework to a stakeholder or another agent | [philosophy.md](philosophy.md) |
| Generate this scaffold via an AI agent | [ai-tooling.md](ai-tooling.md) |
